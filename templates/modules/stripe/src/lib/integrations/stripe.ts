// Generated with: stripe-webhooks skill
// https://github.com/hookdeck/webhook-skills
import Stripe from "stripe";
import { z } from "zod";
import { env } from "../../env";

const stripeEnvironmentSchema = z.object({
  APP_URL: z.string().url(),
  STRIPE_CHECKOUT_CANCEL_PATH: z.string().default("/billing"),
  STRIPE_CHECKOUT_SUCCESS_PATH: z.string().default("/billing/success"),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
});

export function resolveStripeEnvironment() {
  return stripeEnvironmentSchema.parse({
    APP_URL: env.APP_URL,
    STRIPE_CHECKOUT_CANCEL_PATH: env.STRIPE_CHECKOUT_CANCEL_PATH,
    STRIPE_CHECKOUT_SUCCESS_PATH: env.STRIPE_CHECKOUT_SUCCESS_PATH,
    STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET,
  });
}

export function createStripeClient() {
  const configuration = resolveStripeEnvironment();
  const sdk = new Stripe(configuration.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
  });

  return {
    configuration,
    sdk,
    buildCheckoutCancelUrl() {
      return `${configuration.APP_URL}${configuration.STRIPE_CHECKOUT_CANCEL_PATH}`;
    },
    buildCheckoutSuccessUrl() {
      return `${configuration.APP_URL}${configuration.STRIPE_CHECKOUT_SUCCESS_PATH}?session_id={CHECKOUT_SESSION_ID}`;
    },
    constructWebhookEvent(payload: string, signature: string) {
      return sdk.webhooks.constructEvent(payload, signature, configuration.STRIPE_WEBHOOK_SECRET);
    },
  };
}

export const stripeClient = createStripeClient();
