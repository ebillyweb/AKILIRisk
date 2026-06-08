import "server-only";

import type { DeliverablePhase } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ASSESSMENT_PILLAR_IDS,
  normalizePillarScoreId,
} from "@/lib/assessment/pillar-registry";

export type ClientAssessmentSummaryAccess = {
  /** Heat-map Risk Preview once every pillar is scored (PREVIEW phase). */
  canViewRiskPreview: boolean;
  /** Full results with action plan after advisor publishes PROFILE/PORTFOLIO. */
  canViewSummary: boolean;
  allPillarsComplete: boolean;
  advisorPublishedProfile: boolean;
  deliverablePhase: DeliverablePhase;
  assessmentId: string | null;
};

/**
 * Fast path when assessment.status is authoritative (COMPLETED implies all
 * pillars scored via syncAssessmentCompletionStatus).
 */
export function isAssessmentSummaryUnlockedFromStatus(input: {
  status: string;
  deliverablePhase: DeliverablePhase;
}): boolean {
  return (
    input.status === "COMPLETED" &&
    (input.deliverablePhase === "PROFILE" ||
      input.deliverablePhase === "PORTFOLIO")
  );
}

/**
 * Clients may view the Assessment Summary (/assessment/results) only when
 * every pillar is scored and the advisor has published the Risk Profile
 * (deliverablePhase PROFILE or PORTFOLIO).
 */
export function evaluateClientAssessmentSummaryAccess(input: {
  pillarScores: Array<{ pillar: string }>;
  deliverablePhase: DeliverablePhase;
}): Omit<ClientAssessmentSummaryAccess, "assessmentId"> {
  const scoredIds = new Set(
    input.pillarScores.map((row) => normalizePillarScoreId(row.pillar)),
  );
  const allPillarsComplete = ASSESSMENT_PILLAR_IDS.every((id) =>
    scoredIds.has(id),
  );
  const advisorPublishedProfile =
    input.deliverablePhase === "PROFILE" ||
    input.deliverablePhase === "PORTFOLIO";

  return {
    canViewRiskPreview: allPillarsComplete,
    canViewSummary: allPillarsComplete && advisorPublishedProfile,
    allPillarsComplete,
    advisorPublishedProfile,
    deliverablePhase: input.deliverablePhase,
  };
}

export async function getClientAssessmentSummaryAccess(
  clientUserId: string,
): Promise<ClientAssessmentSummaryAccess> {
  const latest = await prisma.assessment.findFirst({
    where: { userId: clientUserId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      deliverablePhase: true,
      scores: { select: { pillar: true } },
    },
  });

  if (!latest) {
    return {
      canViewRiskPreview: false,
      canViewSummary: false,
      allPillarsComplete: false,
      advisorPublishedProfile: false,
      deliverablePhase: "PREVIEW",
      assessmentId: null,
    };
  }

  const evaluated = evaluateClientAssessmentSummaryAccess({
    pillarScores: latest.scores,
    deliverablePhase: latest.deliverablePhase,
  });

  return { ...evaluated, assessmentId: latest.id };
}

export async function getAssessmentSummaryAccessForAssessment(
  assessmentId: string,
  clientUserId: string,
): Promise<ClientAssessmentSummaryAccess> {
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, userId: clientUserId },
    select: {
      id: true,
      deliverablePhase: true,
      scores: { select: { pillar: true } },
    },
  });

  if (!assessment) {
    return {
      canViewRiskPreview: false,
      canViewSummary: false,
      allPillarsComplete: false,
      advisorPublishedProfile: false,
      deliverablePhase: "PREVIEW",
      assessmentId: null,
    };
  }

  const evaluated = evaluateClientAssessmentSummaryAccess({
    pillarScores: assessment.scores,
    deliverablePhase: assessment.deliverablePhase,
  });

  return { ...evaluated, assessmentId: assessment.id };
}
