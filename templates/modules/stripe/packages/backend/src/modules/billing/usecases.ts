import type { Database } from "@/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { getStripeClient } from "@/lib/integrations/stripe";
import { checkoutSessionRequestSchema, planDetailSchema, subscriptionSchema } from "./model";
import * as billingRepository from "./repository";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type DatabaseClient = Database | Transaction;

export async function listPlans(params: { db: DatabaseClient }) {
  const plans = await billingRepository.listPlans(params.db);
  const features = await billingRepository.listPlanFeatures(params.db);

  return plans.map(plan => {
    const scopedFeatures = features.filter(feature => feature.plan_id === plan.id);
    return planDetailSchema.parse({
      ...plan,
      features: scopedFeatures,
    });
  });
}

export async function createCheckoutSessionForOrganization(params: {
  db: DatabaseClient;
  input: unknown;
  organizationId: string;
}) {
  const input = checkoutSessionRequestSchema.parse(params.input);
  const plan = await billingRepository.findPlanById(params.db, input.plan_id);

  if (!plan) {
    throw new NotFoundError("Billing plan");
  }

  const organization = await billingRepository.findOrganizationById(params.db, params.organizationId);

  if (!organization) {
    throw new NotFoundError("Organization");
  }

  const existingSubscription = await billingRepository.findSubscriptionByOrganizationId(
    params.db,
    params.organizationId
  );

  if (existingSubscription?.status === "active" || existingSubscription?.status === "trialing") {
    throw new ConflictError("Organization already has an active subscription");
  }

  const stripeClient = getStripeClient();
  const customerId =
    typeof organization.metadata?.["stripe_customer_id"] === "string"
      ? organization.metadata["stripe_customer_id"]
      : null;

  if (!customerId) {
    throw new ValidationError("Organization metadata must contain stripe_customer_id");
  }

  const session = await stripeClient.sdk.checkout.sessions.create({
    cancel_url: stripeClient.buildCheckoutCancelUrl(),
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    metadata: {
      organization_id: params.organizationId,
      plan_id: plan.id,
      plan_slug: plan.slug,
    },
    mode: "subscription",
    success_url: stripeClient.buildCheckoutSuccessUrl(),
  });

  if (!session.url) {
    throw new ValidationError("Stripe did not return a checkout URL");
  }

  return session.url;
}

export async function syncStripeSubscription(params: {
  db: DatabaseClient;
  organizationId: string;
  planId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: "active" | "canceled" | "past_due" | "trialing";
}) {
  const record = await billingRepository.upsertSubscription(params.db, {
    organization_id: params.organizationId,
    plan_id: params.planId,
    status: params.status,
    stripe_customer_id: params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
  });

  return subscriptionSchema.parse(record);
}
