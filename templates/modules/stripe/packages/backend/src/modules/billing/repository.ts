import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/db";
import { organization, plan, planFeature, subscription, type BillingFeature } from "@/db/schema";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseClient = Database | Transaction;

const ACTIVE_STATUSES = ["active", "trialing"] as const;

export async function listPlans(db: DatabaseClient) {
  return db.select().from(plan).orderBy(asc(plan.monthly_price_cents), asc(plan.name));
}

export async function listPlanFeatures(db: DatabaseClient, planId?: string) {
  if (!planId) {
    return db.select().from(planFeature).orderBy(asc(planFeature.feature));
  }

  return db.select().from(planFeature).where(eq(planFeature.plan_id, planId)).orderBy(asc(planFeature.feature));
}

export async function findPlanById(db: DatabaseClient, planId: string) {
  const [record] = await db.select().from(plan).where(eq(plan.id, planId)).limit(1);
  return record ?? null;
}

export async function findOrganizationById(db: DatabaseClient, organizationId: string) {
  const [record] = await db.select().from(organization).where(eq(organization.id, organizationId)).limit(1);
  return record ?? null;
}

export async function findSubscriptionByOrganizationId(db: DatabaseClient, organizationId: string) {
  const [record] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organization_id, organizationId))
    .limit(1);
  return record ?? null;
}

export async function upsertSubscription(db: DatabaseClient, input: typeof subscription.$inferInsert) {
  const existing = await findSubscriptionByOrganizationId(db, input.organization_id);

  if (existing) {
    const [updated] = await db
      .update(subscription)
      .set({
        canceled_at: input.canceled_at,
        current_period_end: input.current_period_end,
        current_period_start: input.current_period_start,
        plan_id: input.plan_id,
        status: input.status,
        stripe_customer_id: input.stripe_customer_id,
        stripe_subscription_id: input.stripe_subscription_id,
      })
      .where(eq(subscription.id, existing.id))
      .returning();

    return updated ?? existing;
  }

  const [created] = await db.insert(subscription).values(input).returning();
  return created!;
}

export async function getFeatureValueForOrganization(
  db: DatabaseClient,
  organizationId: string,
  feature: BillingFeature
) {
  const [record] = await db
    .select({
      feature: planFeature,
    })
    .from(subscription)
    .innerJoin(planFeature, eq(subscription.plan_id, planFeature.plan_id))
    .where(
      and(
        eq(subscription.organization_id, organizationId),
        inArray(subscription.status, ACTIVE_STATUSES),
        eq(planFeature.feature, feature)
      )
    )
    .limit(1);

  return record?.feature ?? null;
}
