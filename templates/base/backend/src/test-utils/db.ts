import { spawn } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Database } from "../db";
import * as schema from "../db/schema";

type TestDatabaseSetupOptions = {
  migrate?: boolean;
};

const backendRoot = fileURLToPath(new URL("../../", import.meta.url));
const TEST_MIGRATION_LOCK_ID = 81084201;
type TestTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

let testClient: postgres.Sql | null = null;
let testDb: Database | null = null;
let migrationPromise: Promise<void> | null = null;
let hasRunMigrations = false;

function getTestDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_TEST or DATABASE_URL must be defined for backend tests");
  }

  return databaseUrl;
}

function createTestClient() {
  return postgres(getTestDatabaseUrl(), {
    max: 10,
    idle_timeout: 5,
    connect_timeout: 30,
    onnotice: () => {},
  });
}

function getMigrationSentinelPath() {
  const databaseHash = createHash("sha1").update(getTestDatabaseUrl()).digest("hex").slice(0, 12);

  return join(tmpdir(), "{{projectName}}-backend-vitest", `migrated-${databaseHash}.flag`);
}

async function fileExists(path: string) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function hasDrizzleMigrationsTable(client: postgres.Sql) {
  const result = await client<{ exists: boolean }[]>`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = '__drizzle_migrations'
    ) as "exists"
  `;

  return result[0]?.exists ?? false;
}

async function runTestMigrations(): Promise<void> {
  const migrationSentinelPath = getMigrationSentinelPath();
  const migrationSentinelExists = await fileExists(migrationSentinelPath);

  if (migrationSentinelExists) {
    return;
  }

  const lockClient = createTestClient();
  let lockAcquired = false;

  try {
    await lockClient`select pg_advisory_lock(${TEST_MIGRATION_LOCK_ID})`;
    lockAcquired = true;

    if (
      (await hasDrizzleMigrationsTable(lockClient)) &&
      (await fileExists(migrationSentinelPath))
    ) {
      return;
    }

    const migrationProcess = spawn("bun", ["run", "db:migrate"], {
      cwd: backendRoot,
      env: {
        ...process.env,
        DATABASE_URL: getTestDatabaseUrl(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    migrationProcess.stdout?.on("data", chunk => {
      stdout += chunk.toString();
    });
    migrationProcess.stderr?.on("data", chunk => {
      stderr += chunk.toString();
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      migrationProcess.once("error", reject);
      migrationProcess.once("close", code => resolve(code ?? 1));
    });

    if (exitCode === 0) {
      await mkdir(join(tmpdir(), "{{projectName}}-backend-vitest"), { recursive: true });
      await writeFile(migrationSentinelPath, new Date().toISOString(), "utf8");
      return;
    }

    throw new Error(
      `Failed to migrate test database.\nSTDOUT:\n${stdout.trim()}\nSTDERR:\n${stderr.trim()}`
    );
  } finally {
    if (lockAcquired) {
      await lockClient`select pg_advisory_unlock(${TEST_MIGRATION_LOCK_ID})`;
    }
    await lockClient.end({ timeout: 1 });
  }
}

export function getTestDb(): Database {
  if (testDb && testClient) {
    return testDb;
  }

  testClient = createTestClient();
  testDb = drizzle(testClient, { schema });

  return testDb;
}

export async function setupTestDatabase(options: TestDatabaseSetupOptions = {}): Promise<Database> {
  const database = getTestDb();

  if (options.migrate && !hasRunMigrations) {
    if (!migrationPromise) {
      migrationPromise = runTestMigrations()
        .then(() => {
          hasRunMigrations = true;
        })
        .finally(() => {
          migrationPromise = null;
        });
    }

    await migrationPromise;
  }

  await database.execute(sql`set client_min_messages = warning`);
  await database.execute(sql`select 1`);

  return database;
}

export async function teardownTestDatabase(): Promise<void> {
  if (!testClient) {
    return;
  }

  await testClient.end({ timeout: 1 });
  testClient = null;
  testDb = null;
  migrationPromise = null;
}

class TestTransactionRollback extends Error {
  constructor() {
    super("__test_transaction_rollback__");
  }
}

export async function withTestTransaction<T>(
  callback: (tx: TestTransaction) => Promise<T>
): Promise<T> {
  const database = getTestDb();
  let completed = false;
  let result!: T;

  try {
    await database.transaction(async transaction => {
      result = await callback(transaction);
      completed = true;
      throw new TestTransactionRollback();
    });
  } catch (error) {
    if (error instanceof TestTransactionRollback) {
      if (!completed) {
        throw new Error("Test transaction completed without returning a result");
      }

      return result;
    }

    throw error;
  }

  throw new Error("Test transaction completed without rolling back");
}
