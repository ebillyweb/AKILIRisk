import "server-only";

import { Resend } from "resend";
import { AdvisorBrandingData } from '@/lib/validation/branding';
import { escapeHtml } from '@/lib/escape-html';
import { clientPortalBrandingDisplayTitle } from '@/lib/client/client-portal-branding';
import type { SendEmailResult } from '@/lib/invitations/email';
import { resolveFromEmailWithName } from "@/lib/email/resolve-from-email";
import { formatEmailSubject } from "@/lib/email/format-email-subject";

/**
 * Enhanced advisor branding data for emails
 */
interface EnhancedAdvisorBranding extends AdvisorBrandingData {
  // Fallback fields for backward compatibility
  advisorName?: string;
  advisorJobTitle?: string;
  advisorEmail?: string;
  advisorPhone?: string;
  advisorLicenseNumber?: string;
  /** @deprecated Logos are not embedded in email HTML; use copy + colors. */
  logoEmailSrc?: string | null;
}

interface EnhancedEmailTemplateData {
  branding: EnhancedAdvisorBranding;
  personalMessage: string;
  invitationUrl: string;
  clientName?: string;
  templateType?: 'invitation' | 'reminder' | 'notification';
}

/**
 * Typographic mark when logos are omitted (copy + color scheme only).
 */
function renderBrandedInitialMark(
  brandName: string,
  primaryColor: string,
): string {
  const initial = brandName.trim().charAt(0).toUpperCase() || "A";
  return `<div style="margin:0 auto 14px;width:52px;height:52px;line-height:52px;border-radius:14px;background:${primaryColor};color:#ffffff;font-size:22px;font-weight:700;text-align:center;">${escapeHtml(initial)}</div>`;
}

function renderEnhancedEmailHeader(branding: EnhancedAdvisorBranding): string {
  const brandName = clientPortalBrandingDisplayTitle(branding);
  const primaryColor = branding.primaryColor || "#1a1a2e";
  const secondaryColor = branding.secondaryColor || "#f5f5f5";

  const headerStyle = `background: ${secondaryColor}; padding: 28px 20px 24px; text-align: center; border-radius: 8px 8px 0 0; border-top: 4px solid ${primaryColor};`;

  return `
    <div style="${headerStyle}">
      ${renderBrandedInitialMark(brandName, primaryColor)}
      <h1 style="color: ${primaryColor}; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em;">${escapeHtml(brandName)}</h1>
      ${branding.tagline ? `<p style="color: ${primaryColor}; margin: 10px auto 0; font-size: 15px; font-style: italic; opacity: 0.82; max-width: 28em;">${escapeHtml(branding.tagline)}</p>` : ""}
    </div>
  `;
}
function generateEmailCSS(branding: EnhancedAdvisorBranding): string {
  const styles = [];

  // Primary brand color
  if (branding.primaryColor) {
    styles.push(`--brand-primary: ${branding.primaryColor};`);
    styles.push(`--brand-primary-light: ${lightenColor(branding.primaryColor, 10)};`);
    styles.push(`--brand-primary-dark: ${darkenColor(branding.primaryColor, 10)};`);
  }

  // Secondary brand color
  if (branding.secondaryColor) {
    styles.push(`--brand-secondary: ${branding.secondaryColor};`);
  }

  // Accent color
  if (branding.accentColor) {
    styles.push(`--brand-accent: ${branding.accentColor};`);
  }

  return styles.length > 0 ? `:root { ${styles.join(' ')} }` : '';
}

/**
 * Lighten a hex color by a percentage
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return "#" + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
    (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
    (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
}

/**
 * Renders enhanced email footer with branding
 */
function renderEnhancedEmailFooter(branding: EnhancedAdvisorBranding): string {
  const primaryColor = branding.primaryColor || '#1a1a2e';

  let footerContent = '';

  // Custom footer text
  if (branding.emailFooterText) {
    footerContent += `<p style="margin: 0 0 16px 0; color: #666; font-size: 14px;">${escapeHtml(branding.emailFooterText)}</p>`;
  }

  // Support contact information
  const contactInfo = [];

  if (branding.supportEmail) {
    contactInfo.push(`<a href="mailto:${escapeHtml(branding.supportEmail)}" style="color: ${primaryColor}; text-decoration: none;">${escapeHtml(branding.supportEmail)}</a>`);
  }

  if (branding.supportPhone) {
    contactInfo.push(`<a href="tel:${escapeHtml(branding.supportPhone)}" style="color: ${primaryColor}; text-decoration: none;">${escapeHtml(branding.supportPhone)}</a>`);
  }

  if (contactInfo.length > 0) {
    footerContent += `<p style="margin: 0; color: #666; font-size: 14px;">Support: ${contactInfo.join(' | ')}</p>`;
  }

  // Website link
  if (branding.websiteUrl) {
    footerContent += `<p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">Visit us at <a href="${escapeHtml(branding.websiteUrl)}" style="color: ${primaryColor}; text-decoration: none;">${escapeHtml(branding.websiteUrl)}</a></p>`;
  }

  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd;">
      ${footerContent}
    </div>
  `;
}

/**
 * Renders enhanced invitation email template with full branding support
 */
export function renderEnhancedInvitationTemplate(data: EnhancedEmailTemplateData): string {
  const { branding, personalMessage, invitationUrl, clientName } = data;

  // Generate branded CSS
  const brandingCSS = generateEmailCSS(branding);

  // Safe values with fallbacks
  const greeting = clientName ? `Dear ${escapeHtml(clientName)},` : 'Hello,';
  const safePersonalMessage = escapeHtml(personalMessage);

  // Button styling
  const buttonColor = branding.primaryColor || '#1a1a2e';
  const buttonStyle = `
    display: inline-block;
    background: ${buttonColor};
    color: white;
    padding: 12px 32px;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 500;
    transition: background-color 0.2s ease;
  `;

  // Accent bar color
  const accentColor = branding.accentColor || branding.primaryColor || '#1a1a2e';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Risk Assessment Invitation</title>
        <style>
          ${brandingCSS}

          .email-container {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }

          .message-box {
            margin: 24px 0;
            padding: 16px;
            background: white;
            border-radius: 6px;
            border-left: 4px solid ${accentColor};
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }

          .cta-button:hover {
            background: var(--brand-primary-dark, ${darkenColor(buttonColor, 10)}) !important;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9f9f9;">
        <div class="email-container">
          <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

            <!-- Header with Branding -->
            ${renderEnhancedEmailHeader(branding)}

            <!-- Main Content -->
            <div style="padding: 32px;">

              <!-- Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 16px;">
                ${greeting}
              </p>

              <!-- Personal Message -->
              <div class="message-box">
                <p style="margin: 0; font-style: italic; color: #555;">
                  ${safePersonalMessage}
                </p>
              </div>

              <!-- Main Description -->
              <p style="margin: 24px 0; font-size: 16px; line-height: 1.6;">
                Your Risk Manager has invited you to complete your initial risk assessment. This secure platform will help identify potential vulnerabilities and provide personalized recommendations for your family's protection.
              </p>

              <!-- Call to Action -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${invitationUrl}" style="${buttonStyle}" class="cta-button">
                  Start Your Assessment
                </a>
              </div>

              <!-- Fallback URL -->
              <p style="margin: 24px 0 16px 0; font-size: 14px; color: #666; text-align: center;">
                Or copy and paste this URL into your browser:<br>
                <a href="${invitationUrl}" style="color: ${buttonColor}; word-break: break-all;">${invitationUrl}</a>
              </p>

              <!-- Security Note -->
              <div style="margin: 24px 0; padding: 12px; background: #f8f9fa; border-radius: 6px; border: 1px solid #e9ecef;">
                <p style="margin: 0; font-size: 12px; color: #6c757d;">
                  <strong>Security:</strong> This invitation link is unique to you and will expire in 7 days for security. All data is encrypted and protected.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="padding: 0 32px 32px 32px;">
              ${renderEnhancedEmailFooter(branding)}
            </div>

          </div>

          <!-- Legal Footer -->
          <div style="text-align: center; margin-top: 16px; padding: 16px;">
            <p style="margin: 0; font-size: 12px; color: #999;">
              This email was sent regarding your family risk assessment. If you have any questions, please contact your advisor directly.
            </p>
          </div>

        </div>
      </body>
    </html>
  `;
}

/**
 * Renders enhanced reminder email template
 */
export function renderEnhancedReminderTemplate(data: EnhancedEmailTemplateData): string {
  const { branding, personalMessage, invitationUrl, clientName } = data;

  // Generate branded CSS
  const brandingCSS = generateEmailCSS(branding);

  const greeting = clientName ? `Dear ${escapeHtml(clientName)},` : 'Hello,';
  const buttonColor = branding.primaryColor || '#1a1a2e';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Assessment Reminder</title>
        <style>
          ${brandingCSS}
        </style>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          ${renderEnhancedEmailHeader(branding)}

          <div style="padding: 32px;">
            <p style="margin: 0 0 16px 0; font-size: 16px;">
              ${greeting}
            </p>

            <p style="margin: 16px 0; font-size: 16px;">
              This is a friendly reminder that your family risk assessment is still pending completion.
            </p>

            ${personalMessage ? `
              <div style="margin: 24px 0; padding: 16px; background: #f8f9fa; border-radius: 6px; border-left: 4px solid ${branding.primaryColor || '#1a1a2e'};">
                <p style="margin: 0; font-style: italic; color: #555;">
                  ${escapeHtml(personalMessage)}
                </p>
              </div>
            ` : ''}

            <div style="text-align: center; margin: 32px 0;">
              <a href="${invitationUrl}" style="display: inline-block; background: ${buttonColor}; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Continue Assessment
              </a>
            </div>
          </div>

          ${renderEnhancedEmailFooter(branding)}
        </div>
      </body>
    </html>
  `;
}

export type EnhancedClientSystemEmailData = {
  branding: EnhancedAdvisorBranding;
  clientName?: string | null;
  headline: string;
  /** Pre-escaped HTML paragraphs / lists for the main body. */
  bodyHtml: string;
  cta?: { label: string; href: string };
  disclaimer?: string;
  documentTitle?: string;
};

/**
 * Generic branded client system email (magic link, milestones, reminders).
 */
export function renderEnhancedClientSystemTemplate(
  data: EnhancedClientSystemEmailData,
): string {
  const { branding, clientName, headline, bodyHtml, cta, disclaimer } = data;
  const brandingCSS = generateEmailCSS(branding);
  const greeting = clientName
    ? `Dear ${escapeHtml(clientName)},`
    : "Hello,";
  const buttonColor = branding.primaryColor || "#1a1a2e";
  const accentColor = branding.accentColor || branding.primaryColor || "#1a1a2e";
  const title = escapeHtml(data.documentTitle ?? headline);

  const ctaBlock = cta
    ? `
      <div style="text-align: center; margin: 32px 0;">
        <a href="${escapeHtml(cta.href)}" style="display: inline-block; background: ${buttonColor}; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
          ${escapeHtml(cta.label)}
        </a>
      </div>
      <p style="margin: 16px 0; font-size: 14px; color: #666; text-align: center;">
        Or copy and paste this URL into your browser:<br>
        <a href="${escapeHtml(cta.href)}" style="color: ${buttonColor}; word-break: break-all;">${escapeHtml(cta.href)}</a>
      </p>`
    : "";

  const disclaimerBlock = disclaimer
    ? `<p style="margin: 24px 0 0; font-size: 14px; color: #64748b;">${escapeHtml(disclaimer)}</p>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>${brandingCSS}</style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f9f9f9;">
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            ${renderEnhancedEmailHeader(branding)}
            <div style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px;">${greeting}</p>
              <h2 style="margin: 0 0 16px; font-size: 22px; color: ${buttonColor};">${escapeHtml(headline)}</h2>
              <div style="margin: 16px 0; padding: 16px; background: white; border-radius: 6px; border-left: 4px solid ${accentColor};">
                ${bodyHtml}
              </div>
              ${ctaBlock}
              ${disclaimerBlock}
            </div>
            <div style="padding: 0 32px 32px 32px;">
              ${renderEnhancedEmailFooter(branding)}
            </div>
          </div>
          <div style="text-align: center; margin-top: 16px; padding: 16px;">
            <p style="margin: 0; font-size: 12px; color: #999;">
              This message was sent on behalf of ${escapeHtml(clientPortalBrandingDisplayTitle(branding))}.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Factory function to create appropriate template based on type
 */
export function createEnhancedEmailTemplate(data: EnhancedEmailTemplateData): string {
  switch (data.templateType) {
    case 'reminder':
      return renderEnhancedReminderTemplate(data);
    case 'notification':
      return renderEnhancedClientSystemTemplate({
        branding: data.branding,
        clientName: data.clientName,
        headline: data.personalMessage,
        bodyHtml: `<p style="margin:0;">${escapeHtml(data.invitationUrl)}</p>`,
      });
    case 'invitation':
    default:
      return renderEnhancedInvitationTemplate(data);
  }
}

export type SendEnhancedInvitationData = {
  clientEmail: string;
  branding: AdvisorBrandingData & {
    advisorName?: string;
    advisorJobTitle?: string;
    advisorFirmName?: string;
    advisorEmail?: string;
    advisorPhone?: string;
    advisorLicenseNumber?: string;
    logoEmailSrc?: string | null;
  };
  personalMessage: string;
  invitationUrl: string;
  clientName?: string;
  logoAttachment?: null;
};

/**
 * Sends a branded invitation email (firm copy, colors, and tagline).
 */
export async function sendEnhancedAdvisorInvitationEmail(
  data: SendEnhancedInvitationData
): Promise<SendEmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn(
        "RESEND_API_KEY not set - invitation email not sent. Add RESEND_API_KEY to .env.local to send emails."
      );
      return {
        sent: false,
        reason:
          "RESEND_API_KEY is not configured. Add it to .env.local to send invitation emails.",
      };
    }

    const resend = new Resend(apiKey);
    const advisorName =
      data.branding.advisorName ||
      data.branding.brandName ||
      data.branding.advisorFirmName ||
      "Your advisor";

    const htmlContent = createEnhancedEmailTemplate({
      branding: data.branding,
      personalMessage: data.personalMessage,
      invitationUrl: data.invitationUrl,
      clientName: data.clientName,
      templateType: "invitation",
    });

    const senderName =
      data.branding.advisorFirmName ||
      data.branding.firmName ||
      data.branding.brandName ||
      advisorName;
    
    const result = await resend.emails.send({
      from: resolveFromEmailWithName(senderName),
      to: data.clientEmail,
      subject: formatEmailSubject(
        `Invitation from ${advisorName} - Personal Risk Profile`,
      ),
      html: htmlContent,
    });

    if (result.error) {
      console.error("Resend API error:", result.error);
      return { sent: false, reason: result.error.message || "Email delivery failed." };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send enhanced advisor invitation email:", error);
    return { sent: false, reason: message };
  }
}