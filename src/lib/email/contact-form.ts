import { Resend } from "resend";
import { DESIGNATED_ADMIN_EMAIL } from "@/lib/auth-shared";
import { escapeHtml } from "@/lib/escape-html";
import {
  renderPlatformEmailHeadline,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";
import { LEGAL_ENTITY_NAME } from "@/lib/legal/documents";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";
import { resolveFromEmail } from "@/lib/email/resolve-from-email";
import { formatEmailSubject } from "@/lib/email/format-email-subject";
import { getEnterpriseSalesContactEmail } from "@/lib/billing/enterprise-sales-contact";

export type ContactFormAudience = "general" | "sales";

export type ContactFormEmailPayload = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export function renderContactFormEmailHtml(
  payload: ContactFormEmailPayload,
  audience: ContactFormAudience = "general"
): string {
  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safeSubject = escapeHtml(payload.subject);
  const safeMessage = escapeHtml(payload.message).replace(/\n/g, "<br />");
  const sourceLabel =
    audience === "sales"
      ? "Enterprise sales inquiry (advisor billing)"
      : `${escapeHtml(LEGAL_ENTITY_NAME)} website contact form`;

  const bodyHtml = `
    ${renderPlatformEmailHeadline(audience === "sales" ? "Enterprise sales inquiry" : "New contact form message")}
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">Submitted via the ${sourceLabel}.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;width:120px;color:#0f172a;">Name</td>
        <td style="padding:8px 0;">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;color:#0f172a;">Email</td>
        <td style="padding:8px 0;">${safeEmail}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;color:#0f172a;">Subject</td>
        <td style="padding:8px 0;">${safeSubject}</td>
      </tr>
    </table>
    <h2 style="font-size:16px;margin:24px 0 8px;color:#0f172a;">Message</h2>
    <p style="margin:0;font-size:14px;">${safeMessage}</p>`;

  return wrapPlatformEmailContent({
    documentTitle: "New contact form message",
    appOrigin: getPublicAppUrlStrict(),
    bodyHtml,
  });
}

export function getContactFormRecipientEmail(
  audience: ContactFormAudience = "general"
): string {
  if (audience === "sales") {
    return getEnterpriseSalesContactEmail();
  }
  return process.env.CONTACT_FORM_TO_EMAIL?.trim() || DESIGNATED_ADMIN_EMAIL;
}

export async function sendContactFormEmail(
  payload: ContactFormEmailPayload,
  audience: ContactFormAudience = "general"
): Promise<{ success: true } | { success: false; error: string }> {
  const to = getContactFormRecipientEmail(audience);
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
    const subjectLine = formatEmailSubject(
      payload.subject
        ? audience === "sales"
          ? `[Enterprise Sales] ${payload.subject}`
          : `[Contact] ${payload.subject}`
        : audience === "sales"
          ? `[Enterprise Sales] Inquiry from ${payload.name}`
          : `[Contact] Message from ${payload.name}`,
    );

    await resend.emails.send(
      withPlatformLogoAttachment({
        from: resolveFromEmail(),
        to,
        replyTo: payload.email,
        subject: subjectLine,
        html: renderContactFormEmailHtml(payload, audience),
      })
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to send contact form email:", error);
    return {
      success: false,
      error: "Failed to send your message. Please try again later.",
    };
  }
}
