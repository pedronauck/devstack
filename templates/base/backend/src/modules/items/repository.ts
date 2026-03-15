import { asc, eq } from "drizzle-orm";
import type { Database } from "@/db";
import { items, type NewItem } from "@/db/schema";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseClient = Database | Transaction;

export async function listItems(db: DatabaseClient) {
  return db.select().from(items).orderBy(asc(items.created_at));
}

export async function findItemById(db: DatabaseClient, itemId: string) {
  const [record] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  return record ?? null;
}

export async function createItem(db: DatabaseClient, input: NewItem) {
  const [record] = await db.insert(items).values(input).returning();
  return record;
}

export async function updateItem(db: DatabaseClient, itemId: string, input: Partial<NewItem>) {
  const [record] = await db.update(items).set(input).where(eq(items.id, itemId)).returning();
  return record ?? null;
}

export async function deleteItem(db: DatabaseClient, itemId: string) {
  const [record] = await db.delete(items).where(eq(items.id, itemId)).returning();
  return record ?? null;
}
