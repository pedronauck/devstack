import { z } from "@hono/zod-openapi";

export const itemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .openapi("Item");

export const createItemSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateItemSchema = createItemSchema.partial().strict();

export const itemParamsSchema = z
  .object({
    itemId: z.string().trim().min(1),
  })
  .strict();
