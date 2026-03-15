import { EventSchemas, Inngest } from "inngest";
import { z } from "zod";

export const INNGEST_APP_ID = "{{projectName}}";
export const INNGEST_SERVE_PATH = "/api/inngest";

export const inngestEventSchemas = new EventSchemas().fromSchema({
  "billing/stripe.webhook.received": z
    .object({
      eventId: z.string(),
      eventType: z.string(),
      payload: z.record(z.string(), z.unknown()),
    })
    .strict(),
  "email/send.requested": z
    .object({
      subject: z.string(),
      to: z.array(z.string().email()).min(1),
    })
    .strict(),
});

export type InngestEvents = typeof inngestEventSchemas;

export const inngest = new Inngest({
  id: INNGEST_APP_ID,
  schemas: inngestEventSchemas,
});
