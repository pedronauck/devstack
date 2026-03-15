import { Resend } from "resend";
import { env } from "../../env";

export function createResendClient() {
  if (!env.RESEND_API_KEY) {
    return null;
  }

  return new Resend(env.RESEND_API_KEY);
}
