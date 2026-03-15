import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plan, subscription, type NewSubscription } from "@/db/schema";

export function listPlans() {
  return db.select().from(plan);
}

export async function findPlanById(planId: string) {
  const [record] = await db.select().from(plan).where(eq(plan.id, planId)).limit(1);
  return record ?? null;
}

export async function createPlan(input: typeof plan.$inferInsert) {
  const [record] = await db.insert(plan).values(input).returning();
  return record;
}

export async function findSubscriptionByOrganizationId(organizationId: string) {
  const [record] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organization_id, organizationId))
    .limit(1);

  return record ?? null;
}

export async function upsertSubscription(input: NewSubscription) {
  const [existing] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.organization_id, input.organization_id))
    .limit(1);

  if (!existing) {
    const [created] = await db.insert(subscription).values(input).returning();
    return created;
  }

  const [updated] = await db
    .update(subscription)
    .set(input)
    .where(eq(subscription.organization_id, input.organization_id))
    .returning();

  return updated;
}
