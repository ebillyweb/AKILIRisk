import "server-only";

import type { DeliverablePhase } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizePillarScoreId } from "@/lib/assessment/pillar-registry";
import {
  isAssessmentScopeComplete,
} from "@/lib/assessment/included-pillars";
import {
  getClientAssessmentScope,
  resolveClientAssessmentIncludedPillars,
} from "@/lib/client/assessment-scope";

export type ClientAssessmentSummaryAccess = {
  /** Heat-map Risk Preview once every included pillar is scored (PREVIEW phase). */
  canViewRiskPreview: boolean;
  /** Full results with action plan after advisor publishes PROFILE/PORTFOLIO. */
  canViewSummary: boolean;
  /** True when every pillar in assessment scope has a PillarScore row. */
  allPillarsComplete: boolean;
  advisorPublishedProfile: boolean;
  deliverablePhase: DeliverablePhase;
  assessmentId: string | null;
  /** Resolved scope (always 1–6 canonical ids). */
  includedPillars: string[];
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
 * every included pillar is scored and the advisor has published the Risk Profile
 * (deliverablePhase PROFILE or PORTFOLIO).
 */
export function evaluateClientAssessmentSummaryAccess(input: {
  pillarScores: Array<{ pillar: string }>;
  deliverablePhase: DeliverablePhase;
  /** Already resolved via resolveClientAssessmentIncludedPillars. */
  includedPillars: string[];
}): Omit<ClientAssessmentSummaryAccess, "assessmentId"> {
  const scoredIds = input.pillarScores.map((row) =>
    normalizePillarScoreId(row.pillar),
  );
  const scopeForCompletion =
    input.includedPillars.length > 0 ? input.includedPillars : null;
  const allPillarsComplete =
    scopeForCompletion !== null &&
    isAssessmentScopeComplete(scoredIds, scopeForCompletion);
  const advisorPublishedProfile =
    input.deliverablePhase === "PROFILE" ||
    input.deliverablePhase === "PORTFOLIO";

  return {
    canViewRiskPreview: allPillarsComplete,
    canViewSummary: allPillarsComplete && advisorPublishedProfile,
    allPillarsComplete,
    advisorPublishedProfile,
    deliverablePhase: input.deliverablePhase,
    includedPillars: input.includedPillars,
  };
}

export async function getClientAssessmentSummaryAccess(
  clientUserId: string,
): Promise<ClientAssessmentSummaryAccess> {
  const [latest, approvedScope] = await Promise.all([
    prisma.assessment.findFirst({
      where: { userId: clientUserId },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        deliverablePhase: true,
        includedPillars: true,
        scores: { select: { pillar: true } },
      },
    }),
    getClientAssessmentScope(clientUserId),
  ]);

  const includedPillars = resolveClientAssessmentIncludedPillars({
    assessmentIncludedPillars: latest?.includedPillars,
    approvedScopeIncludedPillars: approvedScope.includedPillars,
    hasAssessmentRow: latest != null,
  });

  if (!latest) {
    return {
      canViewRiskPreview: false,
      canViewSummary: false,
      allPillarsComplete: false,
      advisorPublishedProfile: false,
      deliverablePhase: "PREVIEW",
      assessmentId: null,
      includedPillars,
    };
  }

  const evaluated = evaluateClientAssessmentSummaryAccess({
    pillarScores: latest.scores,
    deliverablePhase: latest.deliverablePhase,
    includedPillars,
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
      includedPillars: true,
      scores: { select: { pillar: true } },
    },
  });

  if (!assessment) {
    const approvedScope = await getClientAssessmentScope(clientUserId);
    return {
      canViewRiskPreview: false,
      canViewSummary: false,
      allPillarsComplete: false,
      advisorPublishedProfile: false,
      deliverablePhase: "PREVIEW",
      assessmentId: null,
      includedPillars: resolveClientAssessmentIncludedPillars({
        approvedScopeIncludedPillars: approvedScope.includedPillars,
        hasAssessmentRow: false,
      }),
    };
  }

  const approvedScope = await getClientAssessmentScope(clientUserId);
  const includedPillars = resolveClientAssessmentIncludedPillars({
    assessmentIncludedPillars: assessment.includedPillars,
    approvedScopeIncludedPillars: approvedScope.includedPillars,
    hasAssessmentRow: true,
  });

  const evaluated = evaluateClientAssessmentSummaryAccess({
    pillarScores: assessment.scores,
    deliverablePhase: assessment.deliverablePhase,
    includedPillars,
  });

  return { ...evaluated, assessmentId: assessment.id };
}
