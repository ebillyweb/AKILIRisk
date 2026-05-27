import { addDays } from "date-fns";
import { escapeHtml } from "@/lib/escape-html";
import {
  renderPlatformEmailCta,
  renderPlatformEmailUrlFallback,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";

/** Policy window for completing paid signup after admin creates an advisor account. */
export const NEW_ADVISOR_PAID_SIGNUP_DEADLINE_DAYS = 30;

/**
 * Built-in grace for an admin-created advisor: entitlement ends at the **first instant of the next
 * UTC calendar day** after `from` (00:00:00 UTC on the following date).
 */
export function newAdvisorGracePeriodEndsAt(from: Date = new Date()): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  return new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
}

export function newAdvisorPaidSignupDeadline(from: Date = new Date()): Date {
  return addDays(from, NEW_ADVISOR_PAID_SIGNUP_DEADLINE_DAYS);
}

/** Calendar fields in UTC (avoids server-local shifting grace / deadline labels). */
export function formatUtcCalendarDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatGracePeriodEndUtcLabel(date: Date): string {
  const datePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
  const hm = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${datePart} at ${hm} UTC`;
}

function publicOriginFromSignInUrl(signInUrl: string): string {
  try {
    return new URL(signInUrl).origin;
  } catch {
    return "";
  }
}

export function buildNewAdvisorWelcomeEmailHtml(opts: {
  displayName: string;
  graceEndsAt: Date;
  paidSignupDeadline: Date;
  signInUrl: string;
  billingUrl: string;
  billingEnabled: boolean;
}): string {
  const name = escapeHtml(opts.displayName.trim() || "Advisor");
  const graceStr = formatGracePeriodEndUtcLabel(opts.graceEndsAt);
  const deadlineStr = formatUtcCalendarDate(opts.paidSignupDeadline);
  const billing = escapeHtml(opts.billingUrl);

  const billingParagraph = opts.billingEnabled
    ? `<p style="margin:20px 0 0;">Complete subscription checkout within <strong style="color:#0f172a;">${NEW_ADVISOR_PAID_SIGNUP_DEADLINE_DAYS} days</strong> (by <strong style="color:#0f172a;">${escapeHtml(deadlineStr)}</strong>). After you sign in, <a href="${billing}" style="color:#b45309;font-weight:600;text-decoration:none;">open Billing</a> to choose your plan.</p>`
    : `<p style="margin:20px 0 0;">When billing is enabled for your organization, complete subscription checkout within <strong style="color:#0f172a;">${NEW_ADVISOR_PAID_SIGNUP_DEADLINE_DAYS} days</strong> (by <strong style="color:#0f172a;">${escapeHtml(deadlineStr)}</strong>).</p>`;

  const billingButton = opts.billingEnabled
    ? `<a href="${billing}" style="display:inline-block;margin:12px 6px 0;padding:12px 22px;border-radius:10px;border:2px solid #ca8a04;color:#92400e;font-weight:600;font-size:14px;text-decoration:none;background:#fffbeb;">Go to Billing</a>`
    : "";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">Hello ${name},</p>
    <p style="margin:0 0 20px;">Your <strong style="color:#0f172a;">advisor account</strong> is ready. You are in a <strong style="color:#0f172a;">grace period</strong> for hub access until the start of the next UTC calendar day.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,#fffbeb 0%,#fef3c7 100%);border-radius:14px;border:1px solid #fcd34d;">
      <tr>
        <td style="padding:18px 20px;">
          <div style="font-size:11px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.08em;">Grace access ends</div>
          <div style="font-size:16px;color:#78350f;margin-top:6px;font-weight:600;line-height:1.4;">${escapeHtml(graceStr)}</div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(180,83,9,0.2);">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">Paid signup deadline</div>
            <div style="font-size:15px;color:#0f172a;margin-top:4px;font-weight:600;">${escapeHtml(deadlineStr)}</div>
          </div>
        </td>
      </tr>
    </table>
    ${billingParagraph}
    <div style="text-align:center;">
      ${renderPlatformEmailCta({ label: "Sign in to your account", href: opts.signInUrl })}
      ${billingButton}
      ${renderPlatformEmailUrlFallback(opts.signInUrl)}
    </div>`;

  const footerHtml = `<p style="margin:0;font-size:12px;line-height:1.55;color:#64748b;text-align:center;">Sent because an administrator created your advisor account.</p>
    <p style="margin:10px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;text-align:center;">If you did not expect this email, contact your firm administrator.</p>`;

  return wrapPlatformEmailContent({
    documentTitle: "Welcome to AKILI Risk Intelligence",
    appOrigin: publicOriginFromSignInUrl(opts.signInUrl),
    bodyHtml,
    footerHtml,
  });
}
