import { toMerged } from "es-toolkit/object";
import type { NewItem } from "../db/schema";
import { generateId } from "../lib/id";

export function createTestItem(overrides: Partial<NewItem> = {}): NewItem {
  return toMerged(
    {
      id: overrides.id ?? generateId(),
      name: "Test Item",
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
    } satisfies NewItem,
    overrides
  );
}
