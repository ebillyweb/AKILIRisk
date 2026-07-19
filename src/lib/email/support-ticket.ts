import { Resend } from "resend";
import { AKILI_BRAND } from "@/lib/brand/tokens";
import { escapeHtml } from "@/lib/escape-html";
import {
  renderPlatformEmailHeadline,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";
import { resolveFromEmail } from "@/lib/email/resolve-from-email";
import { formatEmailSubject } from "@/lib/email/format-email-subject";
import {
  getSupportTicketCategoryLabel,
  type SupportTicketCategory,
} from "@/lib/support/categories";

export type SupportTicketEmailPayload = {
  name: string;
  email: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  userId: string;
  userRole: string;
};

export function getSupportTicketRecipientEmail(): string {
  return (
    process.env.SUPPORT_TICKET_TO_EMAIL?.trim() || AKILI_BRAND.contact.support
  );
}

export function renderSupportTicketEmailHtml(
  payload: SupportTicketEmailPayload
): string {
  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safeSubject = escapeHtml(payload.subject);
  const safeMessage = escapeHtml(payload.message).replace(/\n/g, "<br />");
  const safeCategory = escapeHtml(getSupportTicketCategoryLabel(payload.category));
  const safeRole = escapeHtml(payload.userRole);
  const safeUserId = escapeHtml(payload.userId);

  const bodyHtml = `
    ${renderPlatformEmailHeadline("New support ticket")}
    <p style="margin:0 0 20px;font-size:14px;color:#64748b;">Submitted by an authenticated user via the in-app Support page.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;width:120px;color:#0f172a;">Name</td>
        <td style="padding:8px 0;">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;color:#0f172a;">Email</td>
        <td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#18181b;text-decoration:none;">${safeEmail}</a></td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;color:#0f172a;">Category</td>
        <td style="padding:8px 0;">${safeCategory}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;color:#0f172a;">Subject</td>
        <td style="padding:8px 0;">${safeSubject}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;color:#0f172a;">Role</td>
        <td style="padding:8px 0;">${safeRole}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;font-weight:600;vertical-align:top;color:#0f172a;">User ID</td>
        <td style="padding:8px 0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:12px;">${safeUserId}</td>
      </tr>
    </table>
    <h2 style="font-size:16px;margin:24px 0 8px;color:#0f172a;">Message</h2>
    <p style="margin:0;font-size:14px;">${safeMessage}</p>`;

  return wrapPlatformEmailContent({
    documentTitle: "New support ticket",
    appOrigin: getPublicAppUrlStrict(),
    bodyHtml,
  });
}

export async function sendSupportTicketEmail(
  payload: SupportTicketEmailPayload
): Promise<{ success: true } | { success: false; error: string }> {
  const to = getSupportTicketRecipientEmail();
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY not configured - support ticket email not sent");
    return {
      success: false,
      error: "Support is not configured. Please try again later.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const categoryLabel = getSupportTicketCategoryLabel(payload.category);
    const subjectLine = formatEmailSubject(
      `[Support] [${categoryLabel}] ${payload.subject}`
    );

    await resend.emails.send(
      withPlatformLogoAttachment({
        from: resolveFromEmail(),
        to,
        replyTo: payload.email,
        subject: subjectLine,
        html: renderSupportTicketEmailHtml(payload),
      })
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to send support ticket email:", error);
    return {
      success: false,
      error: "Failed to send your ticket. Please try again later.",
    };
  }
}
