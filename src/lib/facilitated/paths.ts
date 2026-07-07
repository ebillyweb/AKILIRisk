import type { FacilitatedSessionStatus } from "@prisma/client";
import { facilitatedSessionStepPath } from "@/lib/facilitated/types";

export function facilitatedSessionRoot(sessionId: string): string {
  return `/advisor/facilitate/${sessionId}`;
}

export function facilitatedIntakePath(sessionId: string): string {
  return `${facilitatedSessionRoot(sessionId)}/intake`;
}

export function facilitatedRiskDomainsPath(sessionId: string): string {
  return `${facilitatedSessionRoot(sessionId)}/risk-domains`;
}

/** @deprecated Use facilitatedRiskDomainsPath */
export const facilitatedPillarsPath = facilitatedRiskDomainsPath;

export function facilitatedAssessmentHubPath(
  sessionId: string,
  options?: { resume?: boolean },
): string {
  const base = `${facilitatedSessionRoot(sessionId)}/assessment`;
  return options?.resume ? `${base}?resume=1` : base;
}

export function facilitatedAssessmentQuestionPath(
  sessionId: string,
  pillarSlug: string,
  questionIndex: number,
  options?: { resume?: boolean },
): string {
  const base = `${facilitatedAssessmentHubPath(sessionId)}/${pillarSlug}/${questionIndex}`;
  return options?.resume ? `${base}?resume=1` : base;
}

export function facilitatedAssessmentCompletePath(sessionId: string): string {
  return `${facilitatedSessionRoot(sessionId)}/assessment/complete`;
}

export function facilitatedPreviewPath(sessionId: string): string {
  return `${facilitatedSessionRoot(sessionId)}/preview`;
}

export function facilitatedSessionResumePath(
  sessionId: string,
  status: FacilitatedSessionStatus,
): string {
  if (status === "ASSESSMENT") {
    return facilitatedAssessmentHubPath(sessionId, { resume: true });
  }
  return facilitatedSessionStepPath(sessionId, status);
}
