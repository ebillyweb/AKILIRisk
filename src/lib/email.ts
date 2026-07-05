import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";
import {
  type ClientEmailContext,
  clientPortalUrl,
} from "@/lib/client/client-email-context";
import {
  sendClientSystemEmail,
  type ClientSystemEmailContent,
} from "@/lib/email/client-branded-system-email";
import {
  renderPlatformEmailCta,
  renderPlatformEmailHeadline,
  renderPlatformEmailUrlFallback,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";
import { resolveFromEmail } from "@/lib/email/resolve-from-email";
import { logResendResult } from "@/lib/email/log-resend-result";
import { formatEmailSubject } from "@/lib/email/format-email-subject";

function appOriginFromUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Absolute verify URL on the client's portal origin (tenant or platform). */
export function buildClientMagicLinkVerifyUrl(
  context: ClientEmailContext | null,
  rawToken: string,
  redirectTo?: string,
): string {
  const origin = clientPortalUrl(context, "/").replace(/\/$/, "");
  const url = new URL("/auth/magic-link/verify", `${origin}/`);
  url.searchParams.set("token", rawToken);
  if (redirectTo?.trim()) {
    url.searchParams.set("redirectTo", redirectTo.trim());
  }
  return url.toString();
}

export function buildMagicLinkEmailContent(
  magicLinkUrl: string,
  context?: ClientEmailContext | null,
  clientName?: string | null,
): ClientSystemEmailContent {
  const firm = context?.firmDisplayName ?? "AKILI Risk Intelligence";
  const isBranded = Boolean(context?.isBranded);
  return {
    subject: isBranded ? `Sign in to ${firm}` : "Sign in to Akili Risk",
    documentTitle: isBranded ? `Sign in to ${firm}` : "Sign in to AKILI",
    headline: isBranded ? `Sign in to ${firm}` : "Sign in to AKILI",
    clientName,
    bodyHtml: `<p style="margin:0;">Use the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.</p>`,
    cta: { label: "Sign in", href: magicLinkUrl },
    disclaimer:
      "If you did not request this sign-in link, you can ignore this email. The link will expire on its own.",
  };
}

export function buildIntakeApprovedEmailContent(
  clientName: string,
  advisorFirmName: string,
  magicLinkUrl: string,
  context?: ClientEmailContext | null,
): ClientSystemEmailContent {
  const firm = context?.firmDisplayName ?? advisorFirmName;
  const safeClient = escapeHtml(clientName);
  const safeFirm = escapeHtml(firm);

  const greetingLine = context?.isBranded
    ? ""
    : `<p style="margin:0 0 16px;">Hello ${safeClient},</p>`;

  return {
    subject: `Your assessment is ready — ${sanitizeSubjectFragment(clientName)}`,
    documentTitle: "Your assessment is ready",
    headline: "Your assessment is ready",
    clientName: context?.isBranded ? clientName : null,
    bodyHtml: `
      ${greetingLine}
      <p style="margin:0 0 16px;">${safeFirm} has reviewed and approved your intake. Your household risk assessment is now unlocked.</p>
      <p style="margin:0 0 8px;"><strong>What to do next</strong></p>
      <ol style="margin:0;padding-left:20px;">
        <li style="margin:0 0 8px;">Click the button below to sign in securely (no password needed).</li>
        <li style="margin:0 0 8px;">You will be taken directly to your assessment.</li>
        <li style="margin:0;">Work through each risk pillar at your own pace — your progress is saved automatically.</li>
      </ol>`,
    cta: { label: "Start assessment", href: magicLinkUrl },
    disclaimer:
      "This sign-in link expires in 15 minutes and can only be used once. If you did not expect this email, you can ignore it.",
  };
}

function renderSimplePlatformEmail(
  documentTitle: string,
  headline: string,
  bodyParagraphs: string,
  cta: { label: string; href: string },
  disclaimer: string
): string {
  return wrapPlatformEmailContent({
    documentTitle,
    appOrigin: appOriginFromUrl(cta.href),
    bodyHtml: `
      ${renderPlatformEmailHeadline(headline)}
      ${bodyParagraphs}
      ${renderPlatformEmailCta(cta)}
      ${renderPlatformEmailUrlFallback(cta.href)}
      <p style="margin:24px 0 0;font-size:14px;color:#64748b;">${disclaimer}</p>`,
  });
}

/**
 * Render the password-reset email body. Pure function — exported so
 * `email.test.ts` can assert escape behavior without mocking Resend.
 *
 * `resetUrl` is server-built (env-derived base URL + a 32-byte random token),
 * but it's still routed through the same template; we keep the conservative
 * stance of passing all string interpolations through the renderer rather
 * than trusting per-field provenance audits to stay correct over time.
 */
export function renderPasswordResetEmailHtml(resetUrl: string): string {
  return renderSimplePlatformEmail(
    "Reset your password",
    "Reset your password",
    `<p style="margin:0 0 16px;">You requested a password reset for your AKILI Risk Intelligence account.</p>
     <p style="margin:0;">Use the button below to choose a new password. This link expires in <strong>15 minutes</strong>.</p>`,
    { label: "Reset password", href: resetUrl },
    "If you did not request this reset, you can ignore this email. Your password will not change."
  );
}

/**
 * Round-11 commit 2 (BRD §5.1.AUTH): magic-link sign-in email body.
 *
 * Same shape + voice as the password-reset template (subject differs,
 * body explains "click to sign in" rather than "click to reset").
 * `magicLinkUrl` is server-built; routed through escapeHtml as a defense
 * against any future drift that lets user input leak into the URL.
 */
export function renderMagicLinkEmailHtml(magicLinkUrl: string): string {
  return renderSimplePlatformEmail(
    "Sign in to AKILI",
    "Sign in to AKILI",
    `<p style="margin:0;">Use the button below to sign in. This link expires in <strong>15 minutes</strong> and can only be used once.</p>`,
    { label: "Sign in", href: magicLinkUrl },
    "If you did not request this sign-in link, you can ignore this email. The link will expire on its own."
  );
}

/**
 * Intake-approved email: magic link that lands on /assessment after sign-in.
 * `clientName` and `advisorFirmName` are user-controlled — escape both.
 */
export function renderIntakeApprovedMagicLinkEmailHtml(
  clientName: string,
  advisorFirmName: string,
  magicLinkUrl: string
): string {
  const safeClientName = escapeHtml(clientName);
  const safeAdvisorFirmName = escapeHtml(advisorFirmName);

  return wrapPlatformEmailContent({
    documentTitle: "Your assessment is ready",
    appOrigin: appOriginFromUrl(magicLinkUrl),
    bodyHtml: `
      ${renderPlatformEmailHeadline("Your assessment is ready")}
      <p style="margin:0 0 16px;">Hello ${safeClientName},</p>
      <p style="margin:0 0 16px;">${safeAdvisorFirmName} has reviewed and approved your intake. Your household risk assessment is now unlocked.</p>
      <p style="margin:0 0 8px;"><strong style="color:#0f172a;">What to do next</strong></p>
      <ol style="margin:0 0 16px;padding-left:20px;color:#334155;">
        <li style="margin:0 0 8px;">Click the button below to sign in securely (no password needed).</li>
        <li style="margin:0 0 8px;">You will be taken directly to your assessment.</li>
        <li style="margin:0;">Work through each risk pillar at your own pace — your progress is saved automatically.</li>
      </ol>
      ${renderPlatformEmailCta({ label: "Start assessment", href: magicLinkUrl })}
      ${renderPlatformEmailUrlFallback(magicLinkUrl)}
      <p style="margin:24px 0 0;font-size:14px;color:#64748b;">This sign-in link expires in <strong>15 minutes</strong> and can only be used once. If you did not expect this email, you can ignore it.</p>`,
  });
}

export async function sendIntakeApprovedMagicLinkEmail(
  email: string,
  clientName: string,
  advisorFirmName: string,
  magicLinkUrl: string,
  context?: ClientEmailContext | null,
): Promise<void> {
  try {
    const content = buildIntakeApprovedEmailContent(
      clientName,
      advisorFirmName,
      magicLinkUrl,
      context,
    );
    const result = await sendClientSystemEmail(email, content, context ?? null);
    if (!result.sent) {
      console.error(
        "Intake-approved magic-link email not sent:",
        "reason" in result ? result.reason : "unknown",
      );
    }
  } catch (error) {
    console.error("Failed to send intake-approved magic-link email:", error);
  }
}

export async function sendMagicLinkEmail(
  email: string,
  magicLinkUrl: string,
  options?: {
    context?: ClientEmailContext | null;
    clientName?: string | null;
  },
): Promise<void> {
  try {
    const content = buildMagicLinkEmailContent(
      magicLinkUrl,
      options?.context,
      options?.clientName,
    );
    const result = await sendClientSystemEmail(
      email,
      content,
      options?.context ?? null,
    );
    if (!result.sent) {
      console.error(
        "Magic-link email not sent:",
        "reason" in result ? result.reason : "unknown",
      );
    }
  } catch (error) {
    console.error("Failed to send magic-link email:", error);
  }
}

/** Mobile app magic link — includes a paste-in 6-digit code fallback. */
export async function sendMobileMagicLinkEmail(
  email: string,
  linkUrl: string,
  code: string
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY not configured - email will not be sent");
      return;
    }

    const safeLinkUrl = escapeHtml(linkUrl);
    const safeCode = escapeHtml(code);

    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: resolveFromEmail(),
      to: email,
      subject: formatEmailSubject("Your AkiliRisk sign-in link"),
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
              <h1 style="color: #18181b; margin-top: 0;">Sign in to AkiliRisk</h1>

              <p style="margin: 16px 0;">
                Tap the button below on your phone to sign in. This link expires in
                <strong>15 minutes</strong>.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${safeLinkUrl}" style="display: inline-block; background: #10b981; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  Open AkiliRisk
                </a>
              </div>

              <p style="margin: 16px 0; font-size: 14px; color: #666;">
                If the button doesn't open the app, enter this 6-digit code in the app instead:
              </p>
              <p style="text-align: center; margin: 8px 0; font-size: 28px; font-weight: 700; letter-spacing: 6px; color: #18181b;">
                ${safeCode}
              </p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">

              <p style="margin: 16px 0; font-size: 14px; color: #666;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
    });
    logResendResult("mobile-magic-link", result);
  } catch (error) {
    console.error("Failed to send mobile magic-link email:", error);
  }
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<void> {
  try {
    // Initialize Resend client at runtime (not module load time)
    // to avoid build-time errors when RESEND_API_KEY is not set
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY not configured - email will not be sent");
      return;
    }

    const resend = new Resend(apiKey);
    const result = await resend.emails.send(
      withPlatformLogoAttachment({
        from: resolveFromEmail(),
        to: email,
        subject: formatEmailSubject("Reset your Akili Risk password"),
        html: renderPasswordResetEmailHtml(resetUrl),
      })
    );
    logResendResult("password-reset", result);
  } catch (error) {
    // Log error but don't throw - prevents email enumeration attacks
    // In production, use proper logging service (e.g., Sentry)
    console.error("Failed to send password reset email:", error);
  }
}

/**
 * Render the advisor "intake ready" notification email body.
 *
 * `clientName`/`advisorName` are user-controlled (clients pick their display
 * name at registration; advisors pick theirs in profile settings) so they
 * MUST flow through escapeHtml. Round-6 bug: the previous shape interpolated
 * them raw, letting a client pick a display name like
 * `<a href="https://evil/phish">Click here</a>` and have it render as a
 * legitimate-looking link inside the advisor's email. `clientEmail` is
 * Zod-validated at registration so won't contain `<` or `"`, but we escape
 * it for defense in depth — if validation ever loosens, the template stays safe.
 *
 * `reviewUrl` is server-built; same conservative stance applies.
 */
export function renderAdvisorIntakeNotificationHtml(
  advisorName: string,
  clientName: string,
  clientEmail: string | null,
  reviewUrl: string
): string {
  const safeAdvisorName = escapeHtml(advisorName);
  const safeClientName = escapeHtml(clientName);
  const safeClientEmail = clientEmail ? escapeHtml(clientEmail) : null;
  const clientFragment = safeClientEmail
    ? `<strong style="color:#0f172a;">${safeClientName}</strong>
        (<a href="mailto:${safeClientEmail}" style="color:#18181b;text-decoration:none;">${safeClientEmail}</a>)`
    : `<strong style="color:#0f172a;">${safeClientName}</strong>`;

  return wrapPlatformEmailContent({
    documentTitle: "New intake ready for review",
    appOrigin: appOriginFromUrl(reviewUrl),
    bodyHtml: `
      ${renderPlatformEmailHeadline("New intake ready for review")}
      <p style="margin:0 0 16px;">Hello ${safeAdvisorName},</p>
      <p style="margin:0 0 8px;">${clientFragment}
        has completed their intake interview and is ready for your review.</p>
      ${renderPlatformEmailCta({ label: "Review intake", href: reviewUrl })}
      ${renderPlatformEmailUrlFallback(reviewUrl)}
      <p style="margin:24px 0 0;font-size:14px;color:#64748b;">This is an automated notification from AKILI Risk Intelligence.</p>`,
  });
}

/**
 * Sanitize a client-supplied display name for safe use as the trailing
 * fragment of an email subject line. Strips CR/LF (defense against header
 * injection — Resend's API likely handles this, but we don't depend on it)
 * and clips to a generous length to keep subjects readable. Returns
 * "Client" for an empty/whitespace input.
 */
function sanitizeSubjectFragment(value: string): string {
  const stripped = value.replace(/[\r\n]+/g, " ").trim();
  if (stripped.length === 0) return "Client";
  return stripped.length > 80 ? stripped.slice(0, 80) : stripped;
}

export async function sendAdvisorIntakeNotification(
  advisorEmail: string,
  advisorName: string,
  clientName: string,
  clientEmail: string | null,
  reviewUrl: string
): Promise<void> {
  try {
    // Initialize Resend client at runtime (not module load time)
    // to avoid build-time errors when RESEND_API_KEY is not set
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY not configured - email will not be sent");
      return;
    }

    const resend = new Resend(apiKey);
    const result = await resend.emails.send(
      withPlatformLogoAttachment({
        from: resolveFromEmail(),
        to: advisorEmail,
        subject: formatEmailSubject(
          `New Intake Ready for Review - ${sanitizeSubjectFragment(clientName)}`,
        ),
        html: renderAdvisorIntakeNotificationHtml(
          advisorName,
          clientName,
          clientEmail,
          reviewUrl
        ),
      })
    );
    logResendResult("advisor-intake-notification", result);
  } catch (error) {
    // Log error but don't throw - prevents blocking the notification flow
    // In production, use proper logging service (e.g., Sentry)
    console.error("Failed to send advisor intake notification:", error);
  }
}
