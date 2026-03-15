import { z } from "@hono/zod-openapi";

export const planSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    stripe_price_id: z.string(),
    monthly_price_cents: z.number().int(),
    is_active: z.boolean(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .openapi("BillingPlan");

export const subscriptionSchema = z
  .object({
    id: z.string(),
    organization_id: z.string(),
    plan_id: z.string(),
    stripe_subscription_id: z.string(),
    stripe_customer_id: z.string(),
    status: z.enum(["active", "past_due", "canceled", "trialing"]),
    current_period_start: z.coerce.date().nullable(),
    current_period_end: z.coerce.date().nullable(),
    canceled_at: z.coerce.date().nullable(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
  })
  .openapi("Subscription");

export const createPlanSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    stripe_price_id: z.string().min(1),
    monthly_price_cents: z.number().int().nonnegative(),
  })
  .strict();

export const planParamsSchema = z.object({ planId: z.string().min(1) }).strict();

export const checkoutSessionRequestSchema = z
  .object({
    organization_id: z.string().min(1),
    plan_id: z.string().min(1),
  })
  .strict();

export const billingOverviewSchema = z
  .object({
    plans: z.array(planSchema),
    subscription: subscriptionSchema.nullable(),
  })
  .strict();
