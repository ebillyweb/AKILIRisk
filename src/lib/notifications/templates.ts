import "server-only";

import { NotificationCategory } from "./types";
import { escapeHtml } from "@/lib/escape-html";

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
 * Template data interfaces for different notification types
 */
interface RegistrationTemplateData {
  clientName: string;
  pipelineUrl: string;
  advisorName?: string;
  firmName?: string;
  logoUrl?: string;
}

interface MilestoneTemplateData {
  clientName: string;
  milestoneName: string;
  clientDetailUrl: string;
  advisorName?: string;
  firmName?: string;
  logoUrl?: string;
}

interface StalledWorkflowTemplateData {
  clientName: string;
  days: number;
  stage: string;
  clientDetailUrl: string;
  advisorName?: string;
  firmName?: string;
  logoUrl?: string;
}

interface AssessmentReminderTemplateData {
  clientName?: string;
  assessmentUrl: string;
  advisorName?: string;
  firmName?: string;
  logoUrl?: string;
}

type TemplateData =
  | RegistrationTemplateData
  | MilestoneTemplateData
  | StalledWorkflowTemplateData
  | AssessmentReminderTemplateData;

/**
 * Renders the header section with optional advisor branding
 */
function renderHeader(firmName?: string, logoUrl?: string): string {
  const logoHtml = logoUrl && isValidLogoUrl(logoUrl) && firmName
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(firmName)} Logo" style="max-height: 60px; display: block;">`
    : '';

  return logoHtml
    ? `<div style="margin-bottom: 24px; text-align: center;">${logoHtml}</div>`
    : '';
}

/**
 * Renders the footer section with advisor signature
 */
function renderFooter(advisorName?: string, firmName?: string): string {
  if (!advisorName && !firmName) {
    return `
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd;">
        <p style="margin: 8px 0; font-size: 12px; color: #666;">
          This is an automated notification from Akili Risk.
        </p>
      </div>
    `;
  }

  return `
    <!-- Advisor Signature Block -->
    <div style="margin: 24px 0;">
      ${advisorName ? `
        <p style="margin: 8px 0; font-size: 16px;">
          <strong>${escapeHtml(advisorName)}</strong>
        </p>
      ` : ''}
      ${firmName ? `
        <p style="margin: 4px 0; color: #666;">
          ${escapeHtml(firmName)}
        </p>
      ` : ''}
    </div>

    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd;">
      <p style="margin: 8px 0; font-size: 12px; color: #666;">
        This is an automated notification from Akili Risk.
        ${advisorName ? `If you have any questions, please contact ${escapeHtml(advisorName)} directly.` : ''}
      </p>
    </div>
  `;
}

/**
 * Registration notification template
 */
function renderRegistrationTemplate(data: RegistrationTemplateData): string {
  const { clientName, pipelineUrl, advisorName, firmName, logoUrl } = data;

  const header = renderHeader(firmName, logoUrl);
  const footer = renderFooter(advisorName, firmName);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          ${header}

          <h1 style="color: #18181b; margin-top: 0;">New Client Registration</h1>

          <p style="margin: 16px 0;">
            <strong>${escapeHtml(clientName)}</strong> has registered from your invitation and is ready to begin their governance assessment.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${pipelineUrl}" style="display: inline-block; background: #18181b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Pipeline
            </a>
          </div>

          <p style="margin: 16px 0; font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:
          </p>
          <p style="margin: 8px 0; font-size: 14px; word-break: break-all;">
            <a href="${pipelineUrl}" style="color: #18181b;">${pipelineUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">

          ${footer}
        </div>
      </body>
    </html>
  `;
}

/**
 * Milestone completion notification template
 */
function renderMilestoneTemplate(data: MilestoneTemplateData): string {
  const { clientName, milestoneName, clientDetailUrl, advisorName, firmName, logoUrl } = data;

  const header = renderHeader(firmName, logoUrl);
  const footer = renderFooter(advisorName, firmName);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          ${header}

          <h1 style="color: #18181b; margin-top: 0;">Milestone Complete</h1>

          <p style="margin: 16px 0;">
            <strong>${escapeHtml(clientName)}</strong> has completed <strong>${escapeHtml(milestoneName)}</strong> in their governance assessment workflow.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${clientDetailUrl}" style="display: inline-block; background: #18181b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Client Details
            </a>
          </div>

          <p style="margin: 16px 0; font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:
          </p>
          <p style="margin: 8px 0; font-size: 14px; word-break: break-all;">
            <a href="${clientDetailUrl}" style="color: #18181b;">${clientDetailUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">

          ${footer}
        </div>
      </body>
    </html>
  `;
}

/**
 * Stalled workflow notification template
 */
function renderStalledWorkflowTemplate(data: StalledWorkflowTemplateData): string {
  const { clientName, days, stage, clientDetailUrl, advisorName, firmName, logoUrl } = data;

  const header = renderHeader(firmName, logoUrl);
  const footer = renderFooter(advisorName, firmName);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          ${header}

          <h1 style="color: #18181b; margin-top: 0;">Workflow Stalled</h1>

          <p style="margin: 16px 0;">
            <strong>${escapeHtml(clientName)}</strong> has been inactive for <strong>${days} days</strong> at the <strong>${escapeHtml(stage)}</strong> stage.
          </p>

          <p style="margin: 16px 0;">
            This client may need follow-up to continue their governance assessment.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${clientDetailUrl}" style="display: inline-block; background: #18181b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Review Client
            </a>
          </div>

          <p style="margin: 16px 0; font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:
          </p>
          <p style="margin: 8px 0; font-size: 14px; word-break: break-all;">
            <a href="${clientDetailUrl}" style="color: #18181b;">${clientDetailUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">

          ${footer}
        </div>
      </body>
    </html>
  `;
}

/**
 * Assessment reminder template (for clients)
 */
function renderAssessmentReminderTemplate(data: AssessmentReminderTemplateData): string {
  const { clientName, assessmentUrl, advisorName, firmName, logoUrl } = data;

  const header = renderHeader(firmName, logoUrl);
  const footer = renderFooter(advisorName, firmName);
  const greeting = clientName ? `Dear ${escapeHtml(clientName)},` : 'Dear client,';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
          ${header}

          <p style="margin: 16px 0; font-size: 16px;">
            ${greeting}
          </p>

          <h1 style="color: #18181b; margin-top: 0;">Your Assessment is Waiting</h1>

          <p style="margin: 16px 0;">
            Your governance assessment is ready to complete. Finishing this assessment will help us provide you with personalized recommendations for protecting and managing your family wealth.
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${assessmentUrl}" style="display: inline-block; background: #18181b; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Complete Assessment
            </a>
          </div>

          <p style="margin: 16px 0; font-size: 14px; color: #666;">
            Or copy and paste this URL into your browser:
          </p>
          <p style="margin: 8px 0; font-size: 14px; word-break: break-all;">
            <a href="${assessmentUrl}" style="color: #18181b;">${assessmentUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #ddd; margin: 24px 0;">

          ${footer}
        </div>
      </body>
    </html>
  `;
}

/**
 * Main template renderer - selects appropriate template based on category
 */
export function renderNotificationEmail(category: NotificationCategory, data: TemplateData): string {
  switch (category) {
    case 'registration':
      return renderRegistrationTemplate(data as RegistrationTemplateData);
    case 'milestone':
      return renderMilestoneTemplate(data as MilestoneTemplateData);
    case 'stalled':
      return renderStalledWorkflowTemplate(data as StalledWorkflowTemplateData);
    case 'reminder':
      return renderAssessmentReminderTemplate(data as AssessmentReminderTemplateData);
    case 'system':
      // System notifications can reuse registration template format
      return renderRegistrationTemplate(data as RegistrationTemplateData);
    default:
      throw new Error(`Unknown notification category: ${category}`);
  }
}