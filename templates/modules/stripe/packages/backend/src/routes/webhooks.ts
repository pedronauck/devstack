import { Hono } from "hono";
import { ValidationError } from "../lib/errors";
import { getStripeClient } from "../lib/integrations/stripe";

export const stripeWebhookRoutes = new Hono();

stripeWebhookRoutes.post("/", async c => {
  const rawBody = await c.req.text();
  const signature = c.req.header("stripe-signature");

  if (!signature) {
    throw new ValidationError("Invalid webhook signature");
  }

  const stripeClient = getStripeClient();
  const event = stripeClient.constructWebhookEvent(rawBody, signature);

  return c.json(
    {
      received: true,
      type: event.type,
    },
    200
  );
});
