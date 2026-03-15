import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { generateId } from "../../lib/id";

export const billingFeatureValues = ["projects", "members", "storage_gb"] as const;
export const billingPlanFeatureValueTypeValues = ["boolean", "integer"] as const;
export const billingSubscriptionStatusValues = ["active", "past_due", "canceled", "trialing"] as const;

export const billingFeatureEnum = pgEnum("billing_feature", billingFeatureValues);
export const billingPlanFeatureValueTypeEnum = pgEnum(
  "billing_plan_feature_value_type",
  billingPlanFeatureValueTypeValues
);
export const billingSubscriptionStatusEnum = pgEnum(
  "billing_subscription_status",
  billingSubscriptionStatusValues
);

export const plan = pgTable(
  "plan",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    stripe_price_id: text("stripe_price_id").notNull(),
    monthly_price_cents: integer("monthly_price_cents").notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("plan_slug_unique").on(table.slug),
    uniqueIndex("plan_stripe_price_id_unique").on(table.stripe_price_id),
  ]
);

export const planFeature = pgTable(
  "plan_feature",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    organization_id: text("organization_id").notNull(),
    plan_id: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    feature: billingFeatureEnum("feature").notNull(),
    value_type: billingPlanFeatureValueTypeEnum("value_type").notNull(),
    value_boolean: boolean("value_boolean"),
    value_integer: integer("value_integer"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [index("plan_feature_plan_id_idx").on(table.plan_id)]
);

export const subscription = pgTable(
  "subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    organization_id: text("organization_id").notNull(),
    plan_id: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "restrict" }),
    stripe_subscription_id: text("stripe_subscription_id").notNull(),
    stripe_customer_id: text("stripe_customer_id").notNull(),
    status: billingSubscriptionStatusEnum("status").notNull(),
    current_period_start: timestamp("current_period_start"),
    current_period_end: timestamp("current_period_end"),
    canceled_at: timestamp("canceled_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    uniqueIndex("subscription_org_id_unique").on(table.organization_id),
    uniqueIndex("subscription_stripe_subscription_id_unique").on(table.stripe_subscription_id),
  ]
);
