import type { ModuleDefinition } from "./types.ts";

export const stripeModule: ModuleDefinition = {
  name: "stripe",
  label: "Stripe",
  hint: "Stripe subscriptions, checkout and webhook receiver.",
  envVars: [
    { key: "STRIPE_SECRET_KEY", value: "sk_test_replace_me" },
    { key: "STRIPE_WEBHOOK_SECRET", value: "whsec_replace_me" },
    { key: "STRIPE_CHECKOUT_SUCCESS_PATH", value: "/billing/success" },
    { key: "STRIPE_CHECKOUT_CANCEL_PATH", value: "/billing" },
    { key: "APP_URL", value: "http://localhost:5173" },
  ],
  backend: {
    dependencies: {
      stripe: "^20.4.1",
    },
  },
  claudeSection: `## Stripe Module

- Stripe webhook endpoint lives at \`/api/webhooks/stripe\`.
- Billing routes are mounted at \`/api/v1/billing\`.
- Keep webhook verification on the raw request body.
`,
};
