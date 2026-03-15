import { db, type Database } from "@/db";
import type { BillingFeature } from "@/db/schema";
import * as billingRepository from "@/modules/billing/repository";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseClient = Database | Transaction;

export async function hasFeature(
  organizationId: string,
  feature: BillingFeature,
  database: DatabaseClient = db
) {
  const value = await billingRepository.getFeatureValueForOrganization(database, organizationId, feature);

  if (!value) {
    return false;
  }

  return value.value_type === "boolean"
    ? (value.value_boolean ?? false)
    : (value.value_integer ?? 0) > 0;
}

export async function getFeatureLimit(
  organizationId: string,
  feature: BillingFeature,
  database: DatabaseClient = db
) {
  const value = await billingRepository.getFeatureValueForOrganization(database, organizationId, feature);
  return value?.value_integer ?? 0;
}
