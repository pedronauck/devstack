import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { z } from "zod";
import { generateId } from "../../lib/id";
import { organization } from "./auth";

export const billingFeatureValues = [
  "api_access",
  "priority_support",
  "projects",
  "storage_gb",
  "team_members",
] as const;
export const billingFeatureEnum = pgEnum("billing_feature", billingFeatureValues);
export const billingValueTypeEnum = pgEnum("billing_plan_feature_value_type", ["boolean", "integer"]);
export const billingSubscriptionStatusEnum = pgEnum("billing_subscription_status", [
  "active",
  "canceled",
  "past_due",
  "trialing",
]);

export const billingFeatureSchema = z.enum(billingFeatureValues);

export const plan = pgTable(
  "plan",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 50 }).notNull(),
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
    plan_id: text("plan_id")
      .notNull()
      .references(() => plan.id, { onDelete: "cascade" }),
    feature: billingFeatureEnum("feature").notNull(),
    value_type: billingValueTypeEnum("value_type").notNull(),
    value_boolean: boolean("value_boolean"),
    value_integer: integer("value_integer"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => [
    index("plan_feature_plan_id_idx").on(table.plan_id),
    uniqueIndex("plan_feature_plan_feature_unique").on(table.plan_id, table.feature),
  ]
);

export const subscription = pgTable(
  "subscription",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => generateId()),
    organization_id: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
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

export type BillingFeature = (typeof billingFeatureValues)[number];
