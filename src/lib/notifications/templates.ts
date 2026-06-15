import "server-only";

import { NotificationCategory } from "./types";
import { escapeHtml } from "@/lib/escape-html";
import {
  renderPlatformEmailCta,
  renderPlatformEmailHeadline,
  renderPlatformEmailUrlFallback,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";

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

export interface NotificationTemplateInput {
  title: string;
  message: string;
  referenceId?: string;
}

function normalizeAppBase(appUrl: string): string {
  return appUrl.replace(/\/$/, "");
}

/** Best-effort client name extraction from in-app notification message text. */
function parseClientNameFromMessage(message: string): string | undefined {
  const patterns = [
    /^(.+?) has completed\b/i,
    /^(.+?) uploaded\b/i,
    /^(.+?) has been inactive\b/i,
    /^(.+?) \([^)]+\) has registered\b/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Builds category-specific template data from notification title/message when
 * callers do not supply pre-rendered emailHtml.
 */
export function buildNotificationTemplateData(
  category: NotificationCategory,
  input: NotificationTemplateInput,
  appUrl: string
): TemplateData {
  const base = normalizeAppBase(appUrl);
  const clientName = parseClientNameFromMessage(input.message) ?? "Client";
  const pipelineUrl = `${base}/advisor/pipeline`;
  const clientDetailUrl = input.referenceId
    ? `${pipelineUrl}/${input.referenceId}`
    : pipelineUrl;
  const assessmentUrl = `${base}/assessment`;

  switch (category) {
    case "milestone":
      return {
        clientName,
        milestoneName: input.title,
        clientDetailUrl,
      };
    case "registration":
      return {
        clientName,
        pipelineUrl,
      };
    case "stalled": {
      const stalledMatch = input.message.match(
        /^(.+?) has been inactive for (\d+) days at the (.+) stage$/i
      );
      return {
        clientName: stalledMatch?.[1]?.trim() ?? clientName,
        days: stalledMatch ? Number.parseInt(stalledMatch[2], 10) : 0,
        stage: stalledMatch?.[3]?.trim() ?? input.title,
        clientDetailUrl,
      };
    }
    case "reminder":
      return {
        clientName: clientName !== "Client" ? clientName : undefined,
        assessmentUrl,
      };
    case "system":
      return {
        clientName,
        pipelineUrl,
      };
    default:
      throw new Error(`Unknown notification category: ${category}`);
  }
}

function appOriginFromUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Advisor logo block inside the platform email body (when firm branding is present).
 */
function renderAdvisorLogoHeader(firmName?: string, logoUrl?: string): string {
  if (!logoUrl || !isValidLogoUrl(logoUrl) || !firmName) return "";
  return `<div style="margin-bottom:24px;text-align:center;">
    <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(firmName)} Logo" style="max-height:60px;display:block;margin:0 auto;">
  </div>`;
}

function wrapAdvisorNotificationEmail(options: {
  documentTitle: string;
  actionUrl: string;
  bodyHtml: string;
  footerHtml: string;
  firmName?: string;
  logoUrl?: string;
}): string {
  return wrapPlatformEmailContent({
    documentTitle: options.documentTitle,
    appOrigin: appOriginFromUrl(options.actionUrl),
    bodyHtml: `${renderAdvisorLogoHeader(options.firmName, options.logoUrl)}${options.bodyHtml}${options.footerHtml}`,
  });
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
  const footer = renderFooter(advisorName, firmName);

  return wrapAdvisorNotificationEmail({
    documentTitle: "New client registration",
    actionUrl: pipelineUrl,
    firmName,
    logoUrl,
    bodyHtml: `
      ${renderPlatformEmailHeadline("New client registration")}
      <p style="margin:0 0 8px;"><strong style="color:#0f172a;">${escapeHtml(clientName)}</strong> has registered from your invitation and is ready to begin their personal risk profile.</p>
      ${renderPlatformEmailCta({ label: "View pipeline", href: pipelineUrl })}
      ${renderPlatformEmailUrlFallback(pipelineUrl)}`,
    footerHtml: footer,
  });
}

/**
 * Milestone completion notification template
 */
function renderMilestoneTemplate(data: MilestoneTemplateData): string {
  const { clientName, milestoneName, clientDetailUrl, advisorName, firmName, logoUrl } = data;
  const footer = renderFooter(advisorName, firmName);

  return wrapAdvisorNotificationEmail({
    documentTitle: "Milestone complete",
    actionUrl: clientDetailUrl,
    firmName,
    logoUrl,
    bodyHtml: `
      ${renderPlatformEmailHeadline("Milestone complete")}
      <p style="margin:0 0 8px;"><strong style="color:#0f172a;">${escapeHtml(clientName)}</strong> has completed <strong style="color:#0f172a;">${escapeHtml(milestoneName)}</strong> in their personal risk profile workflow.</p>
      ${renderPlatformEmailCta({ label: "View client details", href: clientDetailUrl })}
      ${renderPlatformEmailUrlFallback(clientDetailUrl)}`,
    footerHtml: footer,
  });
}

/**
 * Stalled workflow notification template
 */
function renderStalledWorkflowTemplate(data: StalledWorkflowTemplateData): string {
  const { clientName, days, stage, clientDetailUrl, advisorName, firmName, logoUrl } = data;
  const footer = renderFooter(advisorName, firmName);

  return wrapAdvisorNotificationEmail({
    documentTitle: "Workflow stalled",
    actionUrl: clientDetailUrl,
    firmName,
    logoUrl,
    bodyHtml: `
      ${renderPlatformEmailHeadline("Workflow stalled")}
      <p style="margin:0 0 12px;"><strong style="color:#0f172a;">${escapeHtml(clientName)}</strong> has been inactive for <strong>${days} days</strong> at the <strong style="color:#0f172a;">${escapeHtml(stage)}</strong> stage.</p>
      <p style="margin:0 0 8px;">This client may need follow-up to continue their personal risk profile.</p>
      ${renderPlatformEmailCta({ label: "Review client", href: clientDetailUrl })}
      ${renderPlatformEmailUrlFallback(clientDetailUrl)}`,
    footerHtml: footer,
  });
}

/**
 * Assessment reminder template (for clients)
 */
function renderAssessmentReminderTemplate(data: AssessmentReminderTemplateData): string {
  const { clientName, assessmentUrl, advisorName, firmName, logoUrl } = data;
  const footer = renderFooter(advisorName, firmName);
  const greeting = clientName ? `Dear ${escapeHtml(clientName)},` : "Dear client,";

  return wrapAdvisorNotificationEmail({
    documentTitle: "Your assessment is waiting",
    actionUrl: assessmentUrl,
    firmName,
    logoUrl,
    bodyHtml: `
      <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">${greeting}</p>
      ${renderPlatformEmailHeadline("Your assessment is waiting")}
      <p style="margin:0 0 8px;">Your personal risk profile is ready to complete. Finishing it helps us provide personalized recommendations for protecting and managing your family wealth.</p>
      ${renderPlatformEmailCta({ label: "Complete assessment", href: assessmentUrl })}
      ${renderPlatformEmailUrlFallback(assessmentUrl)}`,
    footerHtml: footer,
  });
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