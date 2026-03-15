import { db } from "@/db";
import { NotFoundError, UnprocessableEntityError } from "@/lib/errors";
import { createItemSchema, updateItemSchema } from "./model";
import * as repository from "./repository";

function toIssues(issues: Array<{ message: string; path: PropertyKey[] }>) {
  return issues.map(issue => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

export async function listItems() {
  return repository.listItems(db);
}

export async function getItem(itemId: string) {
  const record = await repository.findItemById(db, itemId);

  if (!record) {
    throw new NotFoundError("Item");
  }

  return record;
}

export async function createItem(input: unknown) {
  const parsed = createItemSchema.safeParse(input);

  if (!parsed.success) {
    throw new UnprocessableEntityError("Validation failed", toIssues(parsed.error.issues));
  }

  return repository.createItem(db, {
    description: parsed.data.description ?? null,
    name: parsed.data.name,
  });
}

export async function updateItem(itemId: string, input: unknown) {
  const parsed = updateItemSchema.safeParse(input);

  if (!parsed.success) {
    throw new UnprocessableEntityError("Validation failed", toIssues(parsed.error.issues));
  }

  const record = await repository.updateItem(db, itemId, {
    ...(parsed.data.description !== undefined ? { description: parsed.data.description ?? null } : {}),
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
  });

  if (!record) {
    throw new NotFoundError("Item");
  }

  return record;
}

export async function deleteItem(itemId: string) {
  const record = await repository.deleteItem(db, itemId);

  if (!record) {
    throw new NotFoundError("Item");
  }

  return record;
}
