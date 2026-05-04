import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";

const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

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
  const safeUrl = escapeHtml(resetUrl);
  return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
              <h1 style="color: #18181b; margin-top: 0;">Reset Your Password</h1>

              <p style="margin: 16px 0;">
                You requested a password reset for your Belvedere Risk Management account.
              </p>

              <p style="margin: 16px 0;">
                Click the button below to reset your password. This link will expire in <strong>15 minutes</strong>.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${safeUrl}" style="display: inline-block; background: #18181b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  Reset Password
                </a>
              </div>

              <p style="margin: 16px 0; font-size: 14px; color: #666;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin: 8px 0; font-size: 14px; word-break: break-all;">
                <a href="${safeUrl}" style="color: #18181b;">${safeUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">

              <p style="margin: 16px 0; font-size: 14px; color: #666;">
                If you didn't request this password reset, you can safely ignore this email. Your password will not be changed.
              </p>
            </div>
          </body>
        </html>
      `;
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
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your Belvedere password",
      html: renderPasswordResetEmailHtml(resetUrl),
    });
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
  const safeReviewUrl = escapeHtml(reviewUrl);

  return `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
              <h1 style="color: #18181b; margin-top: 0;">New Intake Ready for Review</h1>

              <p style="margin: 16px 0;">
                Hello ${safeAdvisorName},
              </p>

              <p style="margin: 16px 0;">
                <strong>${safeClientName}</strong> (<a href="mailto:${safeClientEmail}" style="color: #18181b;">${safeClientEmail}</a>) has completed their intake interview and is ready for your review.
              </p>

              <div style="text-align: center; margin: 32px 0;">
                <a href="${safeReviewUrl}" style="display: inline-block; background: #18181b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                  Review Intake
                </a>
              </div>

              <p style="margin: 16px 0; font-size: 14px; color: #666;">
                Or copy and paste this URL into your browser:
              </p>
              <p style="margin: 8px 0; font-size: 14px; word-break: break-all;">
                <a href="${safeReviewUrl}" style="color: #18181b;">${safeReviewUrl}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">

              <p style="margin: 16px 0; font-size: 14px; color: #666;">
                This is an automated notification from Belvedere Risk Management.
              </p>
            </div>
          </body>
        </html>
      `;
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
    await resend.emails.send({
      from: FROM_EMAIL,
      to: advisorEmail,
      subject: `New Intake Ready for Review - ${sanitizeSubjectFragment(clientName)}`,
      html: renderAdvisorIntakeNotificationHtml(
        advisorName,
        clientName,
        clientEmail,
        reviewUrl
      ),
    });
  } catch (error) {
    // Log error but don't throw - prevents blocking the notification flow
    // In production, use proper logging service (e.g., Sentry)
    console.error("Failed to send advisor intake notification:", error);
  }
}
