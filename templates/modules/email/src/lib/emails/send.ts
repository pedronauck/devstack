import { render } from "@react-email/components";
import nodemailer from "nodemailer";
import { createElement } from "react";
import { z } from "zod";
import { createResendClient } from "../integrations/resend";
import { EmailLayout } from "./templates/layout";
import { env } from "../../env";

export const sendEmailRequestSchema = z
  .object({
    html: z.string().optional(),
    subject: z.string().trim().min(1),
    text: z.string().trim().min(1),
    to: z.array(z.string().email()).min(1),
  })
  .strict();

export type SendEmailRequest = z.infer<typeof sendEmailRequestSchema>;

function createSmtpTransport() {
  return nodemailer.createTransport({
    host: env.MAILPIT_HOST,
    port: env.MAILPIT_PORT,
    secure: false,
  });
}

export async function sendEmail(input: SendEmailRequest) {
  const payload = sendEmailRequestSchema.parse(input);
  const resend = createResendClient();
  const fallbackMarkup =
    payload.html ??
    (await render(
      createElement(
        EmailLayout,
        {
          preview: payload.subject,
          title: payload.subject,
        },
        createElement("p", null, payload.text)
      )
    ));

  if (resend) {
    return resend.emails.send({
      from: env.EMAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      html: fallbackMarkup,
      text: payload.text,
    });
  }

  const transport = createSmtpTransport();

  return transport.sendMail({
    from: env.EMAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    html: fallbackMarkup,
    text: payload.text,
  });
}
