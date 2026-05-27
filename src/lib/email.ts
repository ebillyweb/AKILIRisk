import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";
import {
  renderPlatformEmailCta,
  renderPlatformEmailHeadline,
  renderPlatformEmailUrlFallback,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";

const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

function appOriginFromUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
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

export async function sendMagicLinkEmail(
  email: string,
  magicLinkUrl: string
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("RESEND_API_KEY not configured - magic-link email will not be sent");
      return;
    }

    const resend = new Resend(apiKey);
    await resend.emails.send(
      withPlatformLogoAttachment({
        from: FROM_EMAIL,
        to: email,
        subject: "Sign in to Akili Risk",
        html: renderMagicLinkEmailHtml(magicLinkUrl),
      })
    );
  } catch (error) {
    // Same error semantics as sendPasswordResetEmail: log + swallow to
    // prevent enumeration via response timing or error-shape.
    console.error("Failed to send magic-link email:", error);
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
    await resend.emails.send(
      withPlatformLogoAttachment({
        from: FROM_EMAIL,
        to: email,
        subject: "Reset your Akili Risk password",
        html: renderPasswordResetEmailHtml(resetUrl),
      })
    );
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
  clientEmail: string,
  reviewUrl: string
): string {
  const safeAdvisorName = escapeHtml(advisorName);
  const safeClientName = escapeHtml(clientName);
  const safeClientEmail = escapeHtml(clientEmail);

  return wrapPlatformEmailContent({
    documentTitle: "New intake ready for review",
    appOrigin: appOriginFromUrl(reviewUrl),
    bodyHtml: `
      ${renderPlatformEmailHeadline("New intake ready for review")}
      <p style="margin:0 0 16px;">Hello ${safeAdvisorName},</p>
      <p style="margin:0 0 8px;"><strong style="color:#0f172a;">${safeClientName}</strong>
        (<a href="mailto:${safeClientEmail}" style="color:#18181b;text-decoration:none;">${safeClientEmail}</a>)
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
  clientEmail: string,
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
    await resend.emails.send(
      withPlatformLogoAttachment({
        from: FROM_EMAIL,
        to: advisorEmail,
        subject: `New Intake Ready for Review - ${sanitizeSubjectFragment(clientName)}`,
        html: renderAdvisorIntakeNotificationHtml(
          advisorName,
          clientName,
          clientEmail,
          reviewUrl
        ),
      })
    );
  } catch (error) {
    // Log error but don't throw - prevents blocking the notification flow
    // In production, use proper logging service (e.g., Sentry)
    console.error("Failed to send advisor intake notification:", error);
  }
}
