import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { generateId } from "../../lib/id";

export const items = pgTable("items", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  description: text("description"),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
