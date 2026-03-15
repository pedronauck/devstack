import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

export const INNGEST_APP_ID = "{{projectName}}";
export const INNGEST_SERVE_PATH = "/inngest";
export const LOCAL_INNGEST_BASE_URL = "http://localhost:8288";

export const inngestEventSchemas = new EventSchemas().fromSchema({
  "billing/stripe.webhook.received": z
    .object({
      eventId: z.string().min(1),
      eventType: z.string().min(1),
      payload: z.record(z.string(), z.unknown()),
    })
    .strict(),
  "email/send.requested": z
    .object({
      subject: z.string().min(1),
      to: z.array(z.string().email()).min(1),
    })
    .strict(),
});

export function resolveInngestEnvironment(rawEnv: Record<string, string | undefined> = process.env) {
  const isDev = rawEnv.NODE_ENV !== "production";
  return {
    baseUrl: rawEnv.INNGEST_BASE_URL ?? LOCAL_INNGEST_BASE_URL,
    eventKey: rawEnv.INNGEST_EVENT_KEY,
    isDev,
    signingKey: rawEnv.INNGEST_SIGNING_KEY,
  };
}

export const inngestEnvironment = resolveInngestEnvironment();
export const inngest = new Inngest({
  id: INNGEST_APP_ID,
  eventKey: inngestEnvironment.eventKey,
  schemas: inngestEventSchemas,
});
