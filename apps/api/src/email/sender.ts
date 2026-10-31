import { Resend } from "resend";
import { environment } from "../config.js";

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

// Resend was chosen over relaying through a personal mailbox (Gmail/Yandex/
// Mail.ru) because it needs no phone-verified mailbox and isn't tied to any
// one country — the business is expected to move from Moscow to Spain, and
// this works identically either way. No RESEND_API_KEY means the feature
// stays off, same graceful-degradation pattern as the other integrations
// in notifications/.
export async function sendEmail(options: SendEmailOptions) {
  if (!environment.RESEND_API_KEY) {
    throw new Error("email_not_configured");
  }

  const resend = new Resend(environment.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: environment.EMAIL_FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(options.text !== undefined ? { text: options.text } : {})
  });

  if (result.error) {
    throw new Error(`email_send_failed: ${result.error.name} ${result.error.message}`);
  }
}
