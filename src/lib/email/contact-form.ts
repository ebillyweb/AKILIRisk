import { Resend } from "resend";
import { DESIGNATED_ADMIN_EMAIL } from "@/lib/auth-shared";
import { escapeHtml } from "@/lib/escape-html";
import { LEGAL_ENTITY_NAME } from "@/lib/legal/documents";

const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

export type ContactFormEmailPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export function renderContactFormEmailHtml(
  payload: ContactFormEmailPayload
): string {
  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safeSubject = escapeHtml(payload.subject);
  const safeMessage = escapeHtml(payload.message).replace(/\n/g, "<br />");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h1 style="color: #18181b; margin-top: 0;">New contact form message</h1>
          <p style="margin: 16px 0; font-size: 14px; color: #666;">
            Submitted via the ${escapeHtml(LEGAL_ENTITY_NAME)} website contact form.
          </p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; font-weight: 600; vertical-align: top; width: 120px;">Name</td>
              <td style="padding: 8px 0;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Email</td>
              <td style="padding: 8px 0;"><a href="mailto:${safeEmail}" style="color: #18181b;">${safeEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: 600; vertical-align: top;">Subject</td>
              <td style="padding: 8px 0;">${safeSubject}</td>
            </tr>
          </table>
          <h2 style="font-size: 16px; margin: 24px 0 8px;">Message</h2>
          <p style="margin: 0; font-size: 14px; white-space: pre-wrap;">${safeMessage}</p>
        </div>
      </body>
    </html>
  `;
}

export function getContactFormRecipientEmail(): string {
  return process.env.CONTACT_FORM_TO_EMAIL?.trim() || DESIGNATED_ADMIN_EMAIL;
}

export async function sendContactFormEmail(
  payload: ContactFormEmailPayload
): Promise<{ success: true } | { success: false; error: string }> {
  const to = getContactFormRecipientEmail();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured - contact form email not sent");
    return {
      success: false,
      error: "Contact form is not configured. Please try again later.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const subjectLine = payload.subject
      ? `[Contact] ${payload.subject}`
      : `[Contact] Message from ${payload.name}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      replyTo: payload.email,
      subject: subjectLine,
      html: renderContactFormEmailHtml(payload),
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send contact form email:", error);
    return {
      success: false,
      error: "Failed to send your message. Please try again later.",
    };
  }
}
