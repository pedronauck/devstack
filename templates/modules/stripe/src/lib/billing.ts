import { db } from "@/db";
import { planFeature } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function hasFeature(organizationId: string, feature: string) {
  const rows = await db
    .select({
      value_boolean: planFeature.value_boolean,
      value_integer: planFeature.value_integer,
      value_type: planFeature.value_type,
    })
    .from(planFeature)
    .where(and(eq(planFeature.organization_id, organizationId), eq(planFeature.feature, feature)));

  const match = rows[0];

  if (!match) {
    return false;
  }

  return match.value_type === "boolean" ? Boolean(match.value_boolean) : (match.value_integer ?? 0) > 0;
}

export async function getFeatureLimit(organizationId: string, feature: string) {
  const rows = await db
    .select({
      value_integer: planFeature.value_integer,
    })
    .from(planFeature)
    .where(and(eq(planFeature.organization_id, organizationId), eq(planFeature.feature, feature)));

  return rows[0]?.value_integer ?? 0;
}
