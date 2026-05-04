import { addDays } from "date-fns";
import { escapeHtml } from "@/lib/escape-html";

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

const AKILI_TAGLINE = "Intelligent governance for advisory teams";

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
  const signIn = escapeHtml(opts.signInUrl);
  const billing = escapeHtml(opts.billingUrl);
  const origin = publicOriginFromSignInUrl(opts.signInUrl);
  const logoUrl = origin ? `${origin}/android-chrome-192x192.png` : "";
  const logoImg = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="Akili Risk" width="52" height="52" style="display:block;margin:0 auto 14px;border-radius:14px;border:1px solid rgba(248,250,252,0.15);" />`
    : "";

  const billingParagraph = opts.billingEnabled
    ? `<p style="margin:20px 0 0;line-height:1.65;color:#334155;font-size:15px;">Complete subscription checkout within <strong style="color:#0f172a;">${NEW_ADVISOR_PAID_SIGNUP_DEADLINE_DAYS} days</strong> (by <strong style="color:#0f172a;">${escapeHtml(deadlineStr)}</strong>). After you sign in, <a href="${billing}" style="color:#b45309;font-weight:600;text-decoration:none;">open Billing</a> to choose your plan.</p>`
    : `<p style="margin:20px 0 0;line-height:1.65;color:#334155;font-size:15px;">When billing is enabled for your organization, complete subscription checkout within <strong style="color:#0f172a;">${NEW_ADVISOR_PAID_SIGNUP_DEADLINE_DAYS} days</strong> (by <strong style="color:#0f172a;">${escapeHtml(deadlineStr)}</strong>).</p>`;

  const billingButton = opts.billingEnabled
    ? `<a href="${billing}" style="display:inline-block;margin:10px 6px 0;padding:12px 22px;border-radius:10px;border:2px solid #ca8a04;color:#92400e;font-weight:600;font-size:14px;text-decoration:none;background:#fffbeb;">Go to Billing</a>`
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="x-ua-compatible" content="ie=edge" />
  <title>Welcome to Akili Risk</title>
</head>
<body style="margin:0;padding:0;background:#e8ecf1;font-family:'Segoe UI',system-ui,-apple-system,Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#e8ecf1;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.12);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(145deg,#1e293b 0%,#0f172a 55%,#172554 100%);padding:32px 28px 28px;text-align:center;border-bottom:3px solid #d97706;">
              ${logoImg}
              <div style="color:#f8fafc;font-size:22px;font-weight:700;letter-spacing:-0.03em;line-height:1.2;">Akili Risk</div>
              <div style="color:#94a3b8;font-size:13px;margin-top:8px;line-height:1.45;max-width:28em;margin-left:auto;margin-right:auto;">${escapeHtml(AKILI_TAGLINE)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 8px;">
              <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#0f172a;">Hello ${name},</p>
              <p style="margin:0;line-height:1.65;color:#334155;font-size:15px;">Your <strong style="color:#0f172a;">advisor account</strong> is ready. You are in a <strong style="color:#0f172a;">grace period</strong> for hub access until the start of the next UTC calendar day.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 24px;">
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
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;">
              ${billingParagraph}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 32px;text-align:center;">
              <a href="${signIn}" style="display:inline-block;margin:8px 6px 0;padding:14px 28px;border-radius:10px;background:linear-gradient(180deg,#d97706,#b45309);color:#fffbeb;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 4px 14px rgba(180,83,9,0.35);">Sign in to your account</a>
              ${billingButton}
              <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#94a3b8;">Or paste this link into your browser:<br /><span style="word-break:break-all;color:#64748b;">${signIn}</span></p>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px;background:#f1f5f9;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.55;color:#64748b;text-align:center;">© Akili Risk Intelligence · Sent because an administrator created your advisor account.</p>
              <p style="margin:10px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;text-align:center;">If you did not expect this email, contact your firm administrator.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}
