import { ConflictError, NotFoundError, UnprocessableEntityError } from "@/lib/errors";
import { stripeClient } from "@/lib/integrations/stripe";
import { checkoutSessionRequestSchema, createPlanSchema } from "./model";
import * as repository from "./repository";

function toIssues(issues: Array<{ message: string; path: PropertyKey[] }>) {
  return issues.map(issue => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

export async function listPlans() {
  return repository.listPlans();
}

export async function createPlan(input: unknown) {
  const parsed = createPlanSchema.safeParse(input);

  if (!parsed.success) {
    throw new UnprocessableEntityError("Validation failed", toIssues(parsed.error.issues));
  }

  return repository.createPlan(parsed.data);
}

export async function getBillingOverview(organizationId: string) {
  return {
    plans: await repository.listPlans(),
    subscription: await repository.findSubscriptionByOrganizationId(organizationId),
  };
}

export async function createCheckoutSession(input: unknown) {
  const parsed = checkoutSessionRequestSchema.safeParse(input);

  if (!parsed.success) {
    throw new UnprocessableEntityError("Validation failed", toIssues(parsed.error.issues));
  }

  const selectedPlan = await repository.findPlanById(parsed.data.plan_id);

  if (!selectedPlan) {
    throw new NotFoundError("Plan");
  }

  const session = await stripeClient.sdk.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        price: selectedPlan.stripe_price_id,
        quantity: 1,
      },
    ],
    metadata: {
      organization_id: parsed.data.organization_id,
      plan_id: selectedPlan.id,
    },
    success_url: stripeClient.buildCheckoutSuccessUrl(),
    cancel_url: stripeClient.buildCheckoutCancelUrl(),
  });

  if (!session.url) {
    throw new ConflictError("Stripe checkout session could not be created");
  }

  return {
    sessionId: session.id,
    url: session.url,
  };
}

export async function recordStripeSubscription(input: {
  current_period_end?: Date | null;
  current_period_start?: Date | null;
  organizationId: string;
  planId: string;
  status: "active" | "past_due" | "canceled" | "trialing";
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}) {
  return repository.upsertSubscription({
    organization_id: input.organizationId,
    plan_id: input.planId,
    stripe_subscription_id: input.stripeSubscriptionId,
    stripe_customer_id: input.stripeCustomerId,
    status: input.status,
    current_period_end: input.current_period_end ?? null,
    current_period_start: input.current_period_start ?? null,
    canceled_at: input.status === "canceled" ? new Date() : null,
  });
}
