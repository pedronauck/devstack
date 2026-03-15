import { inngest } from "../lib/inngest";

export const exampleJob = inngest.createFunction(
  { id: "example-email-requested" },
  { event: "email/send.requested" },
  async ({ event }) => {
    return {
      deliveredTo: event.data.to,
      subject: event.data.subject,
    };
  }
);
