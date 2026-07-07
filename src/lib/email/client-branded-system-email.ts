import "server-only";

import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";
import type { ClientEmailContext } from "@/lib/client/client-email-context";
import { formatEmailSubject } from "@/lib/email/format-email-subject";
import {
  renderPlatformEmailCta,
  renderPlatformEmailHeadline,
  renderPlatformEmailUrlFallback,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";
import { resolveFromEmail } from "@/lib/email/resolve-from-email";
import { renderEnhancedClientSystemTemplate } from "@/lib/invitations/enhanced-email";
import type { SendEmailResult } from "@/lib/invitations/email";

export type ClientSystemEmailContent = {
  subject: string;
  documentTitle: string;
  headline: string;
  /** Pre-escaped HTML for the main message body. */
  bodyHtml: string;
  cta?: { label: string; href: string };
  disclaimer?: string;
  clientName?: string | null;
};

export function renderClientSystemEmailHtml(
  content: ClientSystemEmailContent,
  context: ClientEmailContext | null,
): string {
  if (!context?.isBranded || !context.branding) {
    return renderPlatformClientSystemEmail(content, context);
  }

  return renderEnhancedClientSystemTemplate({
    branding: context.branding,
    clientName: content.clientName,
    headline: content.headline,
    bodyHtml: content.bodyHtml,
    cta: content.cta,
    disclaimer: content.disclaimer,
    documentTitle: content.documentTitle,
  });
}

function renderPlatformClientSystemEmail(
  content: ClientSystemEmailContent,
  context: ClientEmailContext | null,
): string {
  const firm = context?.firmDisplayName ?? "AKILI Risk Intelligence";
  const cta = content.cta;
  const disclaimer =
    content.disclaimer ??
    "If you did not expect this message, you can ignore it.";

  return wrapPlatformEmailContent({
    documentTitle: content.documentTitle,
    appOrigin: cta ? new URL(cta.href).origin : null,
    bodyHtml: `
      ${renderPlatformEmailHeadline(content.headline)}
      ${content.bodyHtml}
      ${cta ? renderPlatformEmailCta(cta) : ""}
      ${cta ? renderPlatformEmailUrlFallback(cta.href) : ""}
      <p style="margin:24px 0 0;font-size:14px;color:#64748b;">${escapeHtml(disclaimer)}</p>
      <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">Sent via ${escapeHtml(firm)}.</p>`,
  });
}

export async function sendClientSystemEmail(
  to: string,
  content: ClientSystemEmailContent,
  context: ClientEmailContext | null,
): Promise<SendEmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "RESEND_API_KEY not set - client system email not sent. Add RESEND_API_KEY to .env.local to send emails.",
      );
      return {
        sent: false,
        reason:
          "RESEND_API_KEY is not configured. Add it to .env.local to send emails.",
      };
    }

    const html = renderClientSystemEmailHtml(content, context);
    const resend = new Resend(apiKey);
    const subject = formatEmailSubject(content.subject);

    const payload = context?.isBranded
      ? {
          from: resolveFromEmail(),
          to,
          subject,
          html,
        }
      : withPlatformLogoAttachment({
          from: resolveFromEmail(),
          to,
          subject,
          html,
        });

    const result = await resend.emails.send(payload);

    if (result.error) {
      console.error("Resend API error:", result.error);
      return {
        sent: false,
        reason: result.error.message || "Email delivery failed.",
      };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send client system email:", error);
    return { sent: false, reason: message };
  }
}
