// Generated with: stripe-webhooks skill
// https://github.com/hookdeck/webhook-skills
import { Hono } from "hono";
import { stripeClient } from "@/lib/integrations/stripe";
import { recordStripeSubscription } from "@/modules/billing/usecases";

export const webhooksRoutes = new Hono();

webhooksRoutes.post("/stripe", async c => {
  const payload = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  let event;

  try {
    event = stripeClient.constructWebhookEvent(payload, signature);
  } catch {
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const organizationId = subscription.metadata?.organization_id;
    const planId = subscription.metadata?.plan_id;

    if (organizationId && planId) {
      await recordStripeSubscription({
        organizationId,
        planId,
        status:
          event.type === "customer.subscription.deleted"
            ? "canceled"
            : ((subscription.status === "active" ||
                subscription.status === "trialing" ||
                subscription.status === "past_due")
                ? subscription.status
                : "past_due"),
        stripeCustomerId: String(subscription.customer),
        stripeSubscriptionId: subscription.id,
        current_period_start:
          subscription.items.data[0]?.current_period_start != null
            ? new Date(subscription.items.data[0].current_period_start * 1000)
            : null,
        current_period_end:
          subscription.items.data[0]?.current_period_end != null
            ? new Date(subscription.items.data[0].current_period_end * 1000)
            : null,
      });
    }
  }

  return c.json({ received: true }, 200);
});
