import type { FacilitatedSessionStatus } from "@prisma/client";

export type FacilitatedSessionSummary = {
  id: string;
  clientId: string;
  advisorProfileId: string;
  status: FacilitatedSessionStatus;
  interviewId: string | null;
  assessmentId: string | null;
  startedAt: Date;
  completedAt: Date | null;
  clientName: string | null;
  clientEmail: string | null;
  /** Human-readable in-progress detail for launcher cards (e.g. "Question 3 of 15"). */
  progressDetail: string | null;
  /** Advisor-facing label respecting client data visibility settings. */
  clientDisplayName: string;
  clientDisplayPseudonymous: boolean;
};

/** Resumable in-progress steps only — not PREVIEW (formal review / finish flow). */
export const OPEN_FACILITATED_STATUSES: FacilitatedSessionStatus[] = [
  "INTAKE",
  "PILLAR_SELECT",
  "ASSESSMENT",
];

export function facilitatedSessionStepPath(
  sessionId: string,
  status: FacilitatedSessionStatus,
): string {
  switch (status) {
    case "INTAKE":
      return `/advisor/facilitate/${sessionId}/intake`;
    case "PILLAR_SELECT":
      return `/advisor/facilitate/${sessionId}/pillars`;
    case "ASSESSMENT":
      return `/advisor/facilitate/${sessionId}/assessment`;
    case "PREVIEW":
      return `/advisor/facilitate/${sessionId}/preview`;
    case "COMPLETE":
      return `/advisor/pipeline`;
    default:
      return `/advisor/facilitate/${sessionId}/intake`;
  }
}
