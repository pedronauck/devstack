import Stripe from "stripe";
import { env } from "../../env";

const DEFAULT_CHECKOUT_CANCEL_PATH = "/billing";
const DEFAULT_CHECKOUT_SUCCESS_PATH = "/billing/success";

export function resolveStripeEnvironment(rawEnv: Record<string, string | undefined> = env) {
  const appUrl = (rawEnv.APP_URL ?? rawEnv.CORS_ORIGIN ?? "http://localhost:5173").split(",")[0]!.trim();

  return {
    appUrl: appUrl.replace(/\/+$/, ""),
    checkoutCancelPath: rawEnv.STRIPE_CHECKOUT_CANCEL_PATH ?? DEFAULT_CHECKOUT_CANCEL_PATH,
    checkoutSuccessPath: rawEnv.STRIPE_CHECKOUT_SUCCESS_PATH ?? DEFAULT_CHECKOUT_SUCCESS_PATH,
    secretKey: rawEnv.STRIPE_SECRET_KEY ?? "",
    webhookSecret: rawEnv.STRIPE_WEBHOOK_SECRET ?? "",
  };
}

export class StripeClient {
  constructor(
    public readonly sdk: Stripe,
    private readonly configuration: ReturnType<typeof resolveStripeEnvironment>
  ) {}

  buildCheckoutCancelUrl() {
    return `${this.configuration.appUrl}${this.configuration.checkoutCancelPath}`;
  }

  buildCheckoutSuccessUrl() {
    return `${this.configuration.appUrl}${this.configuration.checkoutSuccessPath}?session_id={CHECKOUT_SESSION_ID}`;
  }

  constructWebhookEvent(payload: string, signature: string) {
    return this.sdk.webhooks.constructEvent(payload, signature, this.configuration.webhookSecret);
  }
}

let sharedClient: StripeClient | null = null;

export function getStripeClient(rawEnv: Record<string, string | undefined> = env) {
  if (!sharedClient) {
    const configuration = resolveStripeEnvironment(rawEnv);
    sharedClient = new StripeClient(
      new Stripe(configuration.secretKey || "sk_test_placeholder", {
        maxNetworkRetries: 2,
      }),
      configuration
    );
  }

  return sharedClient;
}
