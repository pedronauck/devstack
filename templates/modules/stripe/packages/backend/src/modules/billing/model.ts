import { z } from "zod";

export const billingFeatureValueSchema = z.union([z.boolean(), z.number().int()]);

export const planFeatureSchema = z
  .object({
    feature: z.string().min(1),
    id: z.string().min(1),
    value_boolean: z.boolean().nullable().optional(),
    value_integer: z.number().int().nullable().optional(),
    value_type: z.enum(["boolean", "integer"]),
  })
  .strict();

export const planSchema = z
  .object({
    id: z.string().min(1),
    is_active: z.boolean(),
    monthly_price_cents: z.number().int(),
    name: z.string().min(1),
    slug: z.string().min(1),
    stripe_price_id: z.string().min(1),
  })
  .strict();

export const planDetailSchema = planSchema.extend({
  features: z.array(planFeatureSchema),
});

export const subscriptionSchema = z
  .object({
    id: z.string().min(1),
    organization_id: z.string().min(1),
    plan_id: z.string().min(1),
    status: z.enum(["active", "canceled", "past_due", "trialing"]),
    stripe_customer_id: z.string().min(1),
    stripe_subscription_id: z.string().min(1),
  })
  .strict();

export const checkoutSessionRequestSchema = z
  .object({
    plan_id: z.string().min(1),
  })
  .strict();
