import "server-only";

import { escapeHtml } from "@/lib/escape-html";
import {
  clientPortalUrl,
  type ClientEmailContext,
} from "@/lib/client/client-email-context";
import type { ClientSystemEmailContent } from "@/lib/email/client-branded-system-email";

function possessiveClientName(clientName: string | null | undefined): string {
  const name = clientName?.trim();
  if (!name) return "Your";
  return `${name}'s`;
}

export function buildPreviewAvailableClientEmail(
  context: ClientEmailContext | null,
  clientName: string | null,
): ClientSystemEmailContent {
  const firm = context?.firmDisplayName ?? "your advisor";
  const subjectOwner = clientName?.trim() || "Your";

  return {
    subject: `${subjectOwner} Risk Preview is ready`,
    documentTitle: "Your Risk Preview is ready",
    headline: "Your Risk Preview is ready",
    clientName,
    bodyHtml: `<p style="margin:0;">Your questionnaire is complete and a high-level Risk Preview is now viewable. ${escapeHtml(firm)} is preparing your customized Risk Profile and will be in touch within 48 hours.</p>`,
    cta: {
      label: "View risk preview",
      href: clientPortalUrl(context, "/assessment/risk-preview"),
    },
    disclaimer:
      "Sign in with the email address this message was sent to if prompted.",
  };
}

export function buildProfilePublishedClientEmail(
  context: ClientEmailContext | null,
  clientName: string | null,
): ClientSystemEmailContent {
  const firm = context?.firmDisplayName ?? "your advisor";
  const subjectOwner = possessiveClientName(clientName).replace(/'s$/, "");

  return {
    subject:
      subjectOwner === "Your"
        ? "Your Risk Profile is ready"
        : `${subjectOwner}'s Risk Profile is ready`,
    documentTitle: "Your Risk Profile is ready",
    headline: "Your Risk Profile is ready",
    clientName,
    bodyHtml: `<p style="margin:0;">${escapeHtml(firm)} has delivered your customized Risk Profile. Sign in to review detailed results and your recommended plan.</p>`,
    cta: {
      label: "View results",
      href: clientPortalUrl(context, "/assessment/results"),
    },
  };
}

export function buildMeetingScheduledClientEmail(
  context: ClientEmailContext | null,
  clientName: string | null,
  meetingDate: string | null,
): ClientSystemEmailContent {
  const firm = context?.firmDisplayName ?? "Your advisor";
  const meetingNote = meetingDate
    ? ` Your meeting is scheduled for ${escapeHtml(meetingDate)}.`
    : "";

  return {
    subject: "Your Portfolio meeting is scheduled",
    documentTitle: "Portfolio meeting scheduled",
    headline: "Your Portfolio meeting is scheduled",
    clientName,
    bodyHtml: `<p style="margin:0;">${escapeHtml(firm)} has scheduled a meeting to discuss your Risk Portfolio.${meetingNote}</p>`,
    cta: {
      label: "Open dashboard",
      href: clientPortalUrl(context, "/dashboard"),
    },
  };
}

export function buildAssessmentReminderClientEmail(
  context: ClientEmailContext | null,
  clientName: string | null | undefined,
  assessmentUrl: string,
): ClientSystemEmailContent {
  const firm = context?.firmDisplayName ?? "AKILI Risk Intelligence";

  return {
    subject: context?.isBranded
      ? `Your assessment is waiting — ${firm}`
      : "Your Assessment is Waiting",
    documentTitle: "Your assessment is waiting",
    headline: "Your assessment is waiting",
    clientName: clientName ?? null,
    bodyHtml: `<p style="margin:0;">Your personal risk profile is ready to complete. Finishing it helps ${escapeHtml(firm)} provide personalized recommendations for protecting and managing your family wealth.</p>`,
    cta: {
      label: "Complete assessment",
      href: assessmentUrl,
    },
  };
}

export function buildDocumentReminderClientEmail(input: {
  context: ClientEmailContext | null;
  clientName: string | null;
  missingDocuments: string[];
  advisorName: string;
  portalUrl: string;
}): ClientSystemEmailContent {
  const { context, clientName, missingDocuments, advisorName, portalUrl } =
    input;
  const firm = context?.firmDisplayName ?? "your advisor";
  const documentCount = missingDocuments.length;
  const documentsText = documentCount === 1 ? "document is" : "documents are";
  const documentList = missingDocuments
    .map((doc) => `<li style="margin:8px 0;">${escapeHtml(doc)}</li>`)
    .join("");

  return {
    subject: `${documentCount === 1 ? "Document" : "Documents"} needed — ${firm}`,
    documentTitle: "Documents needed",
    headline: "Documents needed for your risk profile",
    clientName,
    bodyHtml: `
      <p style="margin:0 0 16px;">You have <strong>${documentCount}</strong> ${documentsText} still needed for your personal risk profile. Uploading these documents helps ${escapeHtml(firm)} provide more accurate recommendations.</p>
      <p style="margin:0 0 8px;font-weight:600;">Missing documents</p>
      <ul style="margin:0;padding-left:20px;">${documentList}</ul>
      <p style="margin:16px 0 0;">If you have questions, contact ${escapeHtml(advisorName)} at ${escapeHtml(firm)}.</p>`,
    cta: {
      label: "Upload documents",
      href: portalUrl,
    },
  };
}
