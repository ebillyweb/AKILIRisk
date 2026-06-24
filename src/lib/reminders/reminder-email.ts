import "server-only";

import { Resend } from "resend";
import { escapeHtml } from "@/lib/escape-html";
import { resolveFromEmail } from "@/lib/email/resolve-from-email";
import { formatEmailSubject } from "@/lib/email/format-email-subject";

interface DocumentReminderData {
  clientEmail: string;
  clientName: string | null;
  missingDocuments: string[];
  advisorName: string;
  advisorFirmName: string;
  advisorLogoUrl?: string;
  portalUrl: string;
}

export type SendEmailResult = { sent: true } | { sent: false; reason: string };

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
 * Renders the branded document reminder email template
 */
export function renderDocumentReminderTemplate(data: DocumentReminderData): string {
  const {
    clientName,
    missingDocuments,
    advisorName,
    advisorFirmName,
    advisorLogoUrl,
    portalUrl,
  } = data;

  // Sanitize user inputs
  const safeAdvisorName = escapeHtml(advisorName);
  const safeAdvisorFirmName = escapeHtml(advisorFirmName);
  const safeClientName = clientName ? escapeHtml(clientName) : null;

  // Validate and sanitize logo URL
  const logoHtml = advisorLogoUrl && isValidLogoUrl(advisorLogoUrl)
    ? `<img src="${escapeHtml(advisorLogoUrl)}" alt="${safeAdvisorFirmName} Logo" style="max-height: 60px; display: block;">`
    : '';

  const greeting = safeClientName ? `Dear ${safeClientName},` : 'Dear client,';
  const documentCount = missingDocuments.length;
  const documentsText = documentCount === 1 ? 'document is' : 'documents are';

  // Create bulleted list of missing documents
  const documentList = missingDocuments
    .map(doc => `<li style="margin: 8px 0;">${escapeHtml(doc)}</li>`)
    .join('');

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
          ${logoHtml ? `<div style="margin-bottom: 24px; text-align: center;">${logoHtml}</div>` : ''}

          <!-- Greeting -->
          <p style="margin: 16px 0; font-size: 16px;">
            ${greeting}
          </p>

          <!-- Main Message -->
          <p style="margin: 16px 0;">
            You have <strong>${documentCount} ${documentsText}</strong> still needed for your personal risk profile. Uploading these documents will help us provide you with more accurate recommendations.
          </p>

          <!-- Document List -->
          <div style="margin: 24px 0; padding: 16px; background: white; border-radius: 6px; border-left: 4px solid #18181b;">
            <p style="margin: 0 0 12px 0; font-weight: 500;">Missing Documents:</p>
            <ul style="margin: 8px 0; padding-left: 20px;">
              ${documentList}
            </ul>
          </div>

          <!-- Call to Action -->
          <div style="text-align: center; margin: 32px 0;">
            <a href="${portalUrl}" style="display: inline-block; background: #18181b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Upload Documents
            </a>
          </div>

          <!-- Fallback URL -->
          <p style="margin: 16px 0; font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:
          </p>
          <p style="margin: 8px 0; font-size: 14px; word-break: break-all;">
            <a href="${portalUrl}" style="color: #18181b;">${portalUrl}</a>
          </p>

          <!-- Divider -->
          <hr style="border: none; border-top: 1px solid #ddd; margin: 32px 0;">

          <!-- Advisor Signature Block -->
          <div style="margin: 24px 0;">
            <p style="margin: 8px 0; font-size: 16px;">
              <strong>${safeAdvisorName}</strong>
            </p>
            <p style="margin: 4px 0; color: #666;">
              ${safeAdvisorFirmName}
            </p>
          </div>

          <!-- Footer -->
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd;">
            <p style="margin: 8px 0; font-size: 12px; color: #666;">
              This is an automated reminder. If you have any questions about these documents, please contact ${safeAdvisorName} directly.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Sends branded document reminder email via Resend.
 */
export async function sendDocumentReminderEmail(data: DocumentReminderData): Promise<SendEmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("RESEND_API_KEY not set - reminder email not sent. Add RESEND_API_KEY to .env.local to send emails.");
      return { sent: false, reason: "RESEND_API_KEY is not configured. Add it to .env.local to send reminder emails." };
    }

    const resend = new Resend(apiKey);

    const htmlContent = renderDocumentReminderTemplate(data);

    const documentCount = data.missingDocuments.length;
    const documentsText = documentCount === 1 ? 'Document' : 'Documents';
    const subject = formatEmailSubject(
      `${documentsText} Needed - ${data.advisorFirmName}`,
    );

    const result = await resend.emails.send({
      from: resolveFromEmail(),
      to: data.clientEmail,
      subject,
      html: htmlContent,
    });

    if (result.error) {
      console.error("Resend API error:", result.error);
      return { sent: false, reason: result.error.message || "Email delivery failed." };
    }

    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send document reminder email:", error);
    return { sent: false, reason: message };
  }
}