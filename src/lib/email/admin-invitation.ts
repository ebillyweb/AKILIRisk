import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";
import {
  renderPlatformEmailCta,
  renderPlatformEmailNotice,
  renderPlatformEmailPanel,
  renderPlatformEmailUrlFallback,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";
import { withPlatformLogoAttachment } from "@/lib/email/platform-email-logo";
import { getPublicAppUrlStrict } from "@/lib/public-app-url";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** Must match a domain verified in Resend (see FROM_EMAIL in .env). */
const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

function formatFromAddress(): string {
  if (FROM_EMAIL.includes("<")) return FROM_EMAIL;
  return `AKILI Risk Intelligence <${FROM_EMAIL}>`;
}

function resendErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "Failed to send invitation email";
}

function appOriginFromUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

interface AdminInvitationData {
  email: string;
  name: string;
  tempPassword: string;
  role: "ADMIN" | "SUPER_ADMIN";
  invitedBy: string;
}

/**
 * Send invitation email to a new admin user.
 */
export async function sendAdminInvitationEmail(data: AdminInvitationData) {
  if (!resend) {
    console.warn("Resend API key not configured, skipping admin invitation email");
    return { success: false, error: "Email service not configured" };
  }

  const { email, name, tempPassword, role, invitedBy } = data;

  const roleLabel = role === "SUPER_ADMIN" ? "Super Administrator" : "Administrator";
  const baseUrl = getPublicAppUrlStrict();
  if (!baseUrl) {
    console.error(
      "admin-invitation: no public app URL configured (AUTH_URL / NEXT_PUBLIC_URL / NEXTAUTH_URL / VERCEL_URL)"
    );
    return {
      success: false,
      error:
        "Email service misconfigured: public app URL is not set for this environment",
    };
  }
  const loginUrl = `${baseUrl}/signin`;

  try {
    const result = await resend.emails.send(
      withPlatformLogoAttachment({
        from: formatFromAddress(),
        to: [email],
        subject: `Welcome to AKILI Risk Intelligence - ${roleLabel} Access`,
        html: renderAdminInvitationHtml({
          name,
          email,
          role: roleLabel,
          tempPassword,
          loginUrl,
          invitedBy,
        }),
        text: generateAdminInvitationText({
          name,
          email,
          role: roleLabel,
          tempPassword,
          loginUrl,
          invitedBy,
        }),
      })
    );

    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to send admin invitation email:", error);
    return { success: false, error: resendErrorMessage(error) };
  }
}

/** Exported for unit tests (escape + URL behavior without Resend). */
export function renderAdminInvitationHtml(data: {
  name: string;
  email: string;
  role: string;
  tempPassword: string;
  loginUrl: string;
  invitedBy: string;
}): string {
  const safeName = escapeHtml(data.name);
  const safeEmail = escapeHtml(data.email);
  const safeRole = escapeHtml(data.role);
  const safePassword = escapeHtml(data.tempPassword);
  const safeInvitedBy = escapeHtml(data.invitedBy);

  const credentialsInner = `
    <p style="margin:0 0 10px;font-size:14px;color:#334155;"><strong style="color:#0f172a;">Email:</strong><br />
      <span style="font-family:Monaco,Menlo,monospace;font-size:14px;color:#0f172a;">${safeEmail}</span></p>
    <p style="margin:0;font-size:14px;color:#334155;"><strong style="color:#0f172a;">Password:</strong><br />
      <span style="font-family:Monaco,Menlo,monospace;font-size:14px;color:#0f172a;">${safePassword}</span></p>`;

  const superAdminBullet =
    data.role === "Super Administrator"
      ? "<li>Advanced configuration and user provisioning</li>"
      : "";

  const bodyHtml = `
    <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">Hello ${safeName},</p>
    <p style="margin:0 0 16px;">You have been invited by ${safeInvitedBy} to join as a <strong style="color:#0f172a;">${safeRole}</strong>.</p>
    <p style="margin:0 0 8px;">Your account is ready. Sign in with the credentials below and change your password immediately after your first login.</p>
    ${renderPlatformEmailPanel("Your login credentials", credentialsInner)}
    ${renderPlatformEmailCta({ label: "Sign in to AKILI", href: data.loginUrl })}
    ${renderPlatformEmailUrlFallback(data.loginUrl)}
    ${renderPlatformEmailNotice(
      "Security notice",
      "Please change your password immediately after your first login. This temporary password expires in 48 hours."
    )}
    <p style="margin:24px 0 8px;font-weight:600;color:#0f172a;">As a ${safeRole}, you will have access to:</p>
    <ul style="margin:0;padding-left:20px;color:#334155;">
      <li>Platform administration tools</li>
      <li>User management capabilities</li>
      <li>System monitoring and analytics</li>
      ${superAdminBullet}
    </ul>
    <p style="margin:24px 0 0;font-size:14px;color:#64748b;">If you have questions, contact your system administrator.</p>`;

  const footerHtml = `<p style="margin:0;font-size:12px;line-height:1.55;color:#64748b;text-align:center;">This invitation was sent to ${safeEmail}. If you did not expect it, contact your system administrator.</p>`;

  return wrapPlatformEmailContent({
    documentTitle: "Welcome to AKILI Risk Intelligence",
    appOrigin: appOriginFromUrl(data.loginUrl),
    bodyHtml,
    footerHtml,
  });
}

function generateAdminInvitationText(data: {
  name: string;
  email: string;
  role: string;
  tempPassword: string;
  loginUrl: string;
  invitedBy: string;
}): string {
  return `
Welcome to AKILI Risk Intelligence

Hello ${data.name},

You have been invited by ${data.invitedBy} to join AKILI Risk Intelligence as a ${data.role}.

Your account has been created and is ready to use. Please sign in using the credentials below and change your password immediately after your first login.

LOGIN CREDENTIALS:
Email: ${data.email}
Password: ${data.tempPassword}

Sign in here: ${data.loginUrl}

SECURITY NOTICE:
Please change your password immediately after your first login. This temporary password will expire in 48 hours for security purposes.

As a ${data.role}, you'll have access to:
- Platform administration tools
- User management capabilities
- System monitoring and analytics
${data.role === "Super Administrator" ? "- Advanced configuration and user provisioning" : ""}

If you have any questions or need assistance, please contact your system administrator.

This invitation was sent to ${data.email}. If you did not expect this invitation, please contact your system administrator.

© ${new Date().getFullYear()} AKILI Risk Intelligence. All rights reserved.
  `.trim();
}
