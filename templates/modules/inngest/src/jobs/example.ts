import { inngest } from "../lib/inngest";

export const exampleJob = inngest.createFunction(
  { id: "example-email-audit" },
  { event: "email/send.requested" },
  async ({ event }) => {
    return {
      received: event.data.to.length,
      subject: event.data.subject,
    };
  }
);
