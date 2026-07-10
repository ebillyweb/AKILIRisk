import { Resend } from "resend";

import { escapeHtml } from "@/lib/escape-html";
import { formatEmailSubject } from "@/lib/email/format-email-subject";
import { logResendResult } from "@/lib/email/log-resend-result";
import {
  renderPlatformEmailCta,
  renderPlatformEmailHeadline,
  renderPlatformEmailUrlFallback,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";
import { resolveFromEmail } from "@/lib/email/resolve-from-email";

export type AdvisorSignupVerificationContext = "self_serve" | "admin_provisioned";

function verificationIntroCopy(
  context: AdvisorSignupVerificationContext,
  name: string
): string {
  if (context === "admin_provisioned") {
    return `Hi ${name}, an administrator created your AKILI advisor account. Confirm your email to activate sign-in and access the advisor hub.`;
  }

  return `Hi ${name}, thanks for creating your AKILI advisor account. Confirm your email to continue to plan selection and secure checkout.`;
}

export function renderAdvisorSignupVerificationEmailHtml(opts: {
  displayName: string;
  verifyUrl: string;
  expiresHours: number;
  context?: AdvisorSignupVerificationContext;
}): string {
  const name = escapeHtml(opts.displayName.trim() || "Advisor");
  const verifyUrl = opts.verifyUrl;
  const hours = opts.expiresHours;
  const context = opts.context ?? "self_serve";

  let appOrigin: string | null = null;
  try {
    appOrigin = new URL(opts.verifyUrl).origin;
  } catch {
    appOrigin = null;
  }

  return wrapPlatformEmailContent({
    documentTitle: "Confirm your advisor account",
    appOrigin,
    bodyHtml: `
      ${renderPlatformEmailHeadline("Confirm your email to get started")}
      <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">
        ${verificationIntroCopy(context, name)}
      </p>
      <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">
        This link expires in <strong style="color:#0f172a;">${hours} hours</strong>.
      </p>
      ${renderPlatformEmailCta({ label: "Confirm email", href: verifyUrl })}
      ${renderPlatformEmailUrlFallback(verifyUrl)}
      <p style="margin:24px 0 0;font-size:14px;color:#64748b;">
        If you didn&apos;t create an advisor account, you can ignore this email.
      </p>`,
  });
}

export async function sendAdvisorSignupVerificationEmail(opts: {
  to: string;
  displayName: string;
  verifyUrl: string;
  expiresHours?: number;
  context?: AdvisorSignupVerificationContext;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn(
      "[email] RESEND_API_KEY not set — advisor signup verification email skipped",
      { toHash: opts.to.slice(0, 3) + "…" }
    );
    return { sent: false };
  }

  const from = resolveFromEmail();
  const html = renderAdvisorSignupVerificationEmailHtml({
    displayName: opts.displayName,
    verifyUrl: opts.verifyUrl,
    expiresHours: opts.expiresHours ?? 24,
    context: opts.context,
  });

  const resend = new Resend(apiKey);
  const result = await resend.emails.send(
    withPlatformLogoAttachment({
      from,
      to: opts.to,
      subject: formatEmailSubject("Confirm your AKILI advisor account"),
      html,
    })
  );

  const sent = logResendResult("advisor-signup-verification", result);
  return { sent };
}
