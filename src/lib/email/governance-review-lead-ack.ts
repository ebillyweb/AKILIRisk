import "server-only";

import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";
import { formatEmailSubject } from "@/lib/email/format-email-subject";
import { logResendResult } from "@/lib/email/log-resend-result";
import {
  renderPlatformEmailHeadline,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";
import { resolveFromEmail } from "@/lib/email/resolve-from-email";
import { LEGAL_ENTITY_NAME } from "@/lib/legal/documents";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";
import type { SendEmailResult } from "@/lib/invitations/email";

export type GovernanceReviewLeadAckPayload = {
  name: string;
  email: string;
};

function firstNameFromFullName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function renderGovernanceReviewLeadAckEmailHtml(
  payload: GovernanceReviewLeadAckPayload
): string {
  const greetingName = escapeHtml(firstNameFromFullName(payload.name));
  const safeEmail = escapeHtml(payload.email);

  const bodyHtml = `
    ${renderPlatformEmailHeadline("We received your assessment request")}
    <p style="margin:0 0 16px;">Hi ${greetingName},</p>
    <p style="margin:0 0 16px;">
      Thank you for reaching out to ${escapeHtml(LEGAL_ENTITY_NAME)}. This email confirms we received
      your request for a structured risk assessment.
    </p>
    <p style="margin:0 0 16px;">
      A member of our team will follow up at
      ${safeEmail}
      to discuss scope, timing, and next steps. This message is not the full intake — that begins
      only when you choose to move forward.
    </p>
    <p style="margin:0;font-size:14px;color:#64748b;">
      Your details are handled discreetly and used to respond to you personally.
    </p>`;

  return wrapPlatformEmailContent({
    documentTitle: "Assessment request received",
    appOrigin: getPublicAppUrlStrict(),
    bodyHtml,
  });
}

export async function sendGovernanceReviewLeadAckEmail(
  payload: GovernanceReviewLeadAckPayload
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY not set — assessment request acknowledgment email not sent."
    );
    return {
      sent: false,
      reason: "RESEND_API_KEY is not configured.",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send(
      withPlatformLogoAttachment({
        from: resolveFromEmail(),
        to: payload.email,
        subject: formatEmailSubject("We received your AKILI assessment request"),
        html: renderGovernanceReviewLeadAckEmailHtml(payload),
      })
    );

    if (!logResendResult("governance-review-lead-ack", result)) {
      return {
        sent: false,
        reason: result.error?.message ?? "Email provider rejected the message.",
      };
    }

    return { sent: true };
  } catch (error) {
    console.error("Failed to send governance review lead acknowledgment email:", error);
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Failed to send email.",
    };
  }
}
