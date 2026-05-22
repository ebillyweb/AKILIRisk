import "server-only";

import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";
import type { InvitationEmailTheme } from "@/lib/invitations/invitation-email-theme";
import { PLATFORM_INVITATION_CTA_COLOR } from "@/lib/invitations/invitation-email-theme";

const FROM_EMAIL = process.env.FROM_EMAIL || "onboarding@resend.dev";

interface AdvisorInfo {
  advisorName: string;
  advisorJobTitle: string;
  advisorFirmName: string;
  advisorEmail: string;
  advisorPhone: string;
  advisorLicenseNumber: string;
}

interface InvitationTemplateData {
  advisorName: string;
  advisorJobTitle: string;
  advisorFirmName: string;
  advisorEmail: string;
  advisorPhone: string;
  advisorLicenseNumber: string;
  personalMessage: string;
  invitationUrl: string;
  clientName?: string;
  theme: InvitationEmailTheme;
}

interface SendInvitationData {
  clientEmail: string;
  advisorInfo: AdvisorInfo;
  personalMessage: string;
  invitationUrl: string;
  clientName?: string;
  theme: InvitationEmailTheme;
}

/**
 * Validates logo URL (must be HTTPS)
 */
function isValidLogoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Renders the branded invitation email template
 */
export function renderInvitationTemplate(data: InvitationTemplateData): string {
  const {
    advisorName,
    advisorJobTitle,
    advisorFirmName,
    advisorEmail,
    advisorPhone,
    advisorLicenseNumber,
    personalMessage,
    invitationUrl,
    clientName,
    theme,
  } = data;

  const accentColor = theme.accentColor || PLATFORM_INVITATION_CTA_COLOR;

  // Sanitize user inputs
  const safeAdvisorName = escapeHtml(advisorName);
  const safeAdvisorJobTitle = escapeHtml(advisorJobTitle);
  const safeAdvisorFirmName = escapeHtml(advisorFirmName);
  const safeAdvisorEmail = escapeHtml(advisorEmail);
  const safeAdvisorPhone = escapeHtml(advisorPhone);
  const safeAdvisorLicenseNumber = escapeHtml(advisorLicenseNumber);
  const safePersonalMessage = escapeHtml(personalMessage);
  const safeClientName = clientName ? escapeHtml(clientName) : null;

  const logoHtml =
    theme.showAdvisorLogo && theme.logoUrl && isValidLogoUrl(theme.logoUrl)
      ? `<img src="${escapeHtml(theme.logoUrl)}" alt="${safeAdvisorFirmName} Logo" style="max-height: 60px; display: block;">`
      : '';

  const greeting = safeClientName ? `Dear ${safeClientName},` : "Hello,";

  const platformAttribution = theme.showPlatformAttribution
    ? `<p style="margin: 16px 0 0 0; font-size: 12px; color: #666;">
            Sent via <strong>AKILI Risk Intelligence</strong> on behalf of ${safeAdvisorName} at ${safeAdvisorFirmName}.
          </p>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          <!-- Header with Logo -->
          ${logoHtml ? `<div style="margin-bottom: 24px;">${logoHtml}</div>` : ''}

          <!-- Greeting -->
          <p style="margin: 16px 0; font-size: 16px;">
            ${greeting}
          </p>

          <!-- Personal Message -->
          <div style="margin: 24px 0; padding: 16px; background: white; border-radius: 6px; border-left: 4px solid ${accentColor};">
            <p style="margin: 0; font-style: italic;">
              ${safePersonalMessage}
            </p>
          </div>

          <!-- Call to Action -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${invitationUrl}" style="display: inline-block; background: ${accentColor}; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Get Started
            </a>
          </div>

          <!-- Fallback URL -->
          <p style="margin: 16px 0; font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:
          </p>
          <p style="margin: 8px 0; font-size: 14px; word-break: break-all;">
            <a href="${invitationUrl}" style="color: ${accentColor};">${invitationUrl}</a>
          </p>

          ${platformAttribution}

          <!-- Divider -->
          <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;">

          <!-- Advisor Signature Block -->
          <div style="margin: 24px 0;">
            <p style="margin: 8px 0; font-size: 16px;">
              <strong>${safeAdvisorName}</strong>
            </p>
            <p style="margin: 4px 0; color: #666;">
              ${safeAdvisorJobTitle} at ${safeAdvisorFirmName}
            </p>
            <p style="margin: 4px 0; color: #666;">
              <a href="mailto:${safeAdvisorEmail}" style="color: #18181b;">${safeAdvisorEmail}</a>
            </p>
            <p style="margin: 4px 0; color: #666;">
              ${safeAdvisorPhone}
            </p>
            <p style="margin: 4px 0; color: #666; font-size: 14px;">
              License: ${safeAdvisorLicenseNumber}
            </p>
          </div>

          <!-- Footer -->
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd;">
            ${logoHtml ? `<div style="margin-bottom: 12px;">${logoHtml}</div>` : ''}
            <p style="margin: 8px 0; font-size: 12px; color: #666;">
              This invitation link will expire in 7 days. If you have any questions, please contact ${safeAdvisorName} directly.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export type SendEmailResult = { sent: true } | { sent: false; reason: string };

/**
 * Sends branded advisor invitation email via Resend.
 * Returns whether the email was sent so the UI can show the link if not.
 */
export async function sendAdvisorInvitationEmail(data: SendInvitationData): Promise<SendEmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set - invitation email not sent. Add RESEND_API_KEY to .env.local to send emails.");
      return { sent: false, reason: "RESEND_API_KEY is not configured. Add it to .env.local to send invitation emails." };
    }

    const resend = new Resend(apiKey);

    const htmlContent = renderInvitationTemplate({
      ...data.advisorInfo,
      personalMessage: data.personalMessage,
      invitationUrl: data.invitationUrl,
      clientName: data.clientName,
      theme: data.theme,
    });

    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.clientEmail,
      subject: `Invitation from ${data.advisorInfo.advisorName} - Family Governance Assessment`,
      html: htmlContent,
    });

    if (result.error) {
      console.error("Resend API error:", result.error);
      return { sent: false, reason: result.error.message || "Email delivery failed." };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send advisor invitation email:", error);
    return { sent: false, reason: message };
  }
}