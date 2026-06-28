import "server-only";

import { prisma } from "@/lib/db";
import type { PillarDelta } from "@/lib/assessment/reassessment-types";

// ---------------------------------------------------------------------------
// Pure function input type (no Prisma dependency)
// ---------------------------------------------------------------------------

/** Minimal pillar score row for the pure delta function. */
export type PillarScoreRow = {
  pillar: string;
  score: number;
  riskLevel: string;
};

// ---------------------------------------------------------------------------
// Pure function: computePillarDeltas (no DB access)
// ---------------------------------------------------------------------------

/**
 * Compute per-pillar score deltas between two assessment snapshots (D-05).
 *
 * Pure function -- receives pre-fetched data, no side effects.
 *
 * Direction thresholds: > 0.01 = improved, < -0.01 = regressed, else unchanged.
 * Attribution: completed recommendations attributed to each pillar. Pillars
 * with no completed recommendations show ["No new planning activity"] (D-06).
 */
export function computePillarDeltas(
  previousScores: PillarScoreRow[],
  currentScores: PillarScoreRow[],
  completedRecommendations: { pillar: string; name: string }[],
): PillarDelta[] {
  const previousMap = new Map(previousScores.map((s) => [s.pillar, s]));

  return currentScores.map((current) => {
    const prev = previousMap.get(current.pillar);
    const previousScore = prev?.score ?? 0;
    const rawDelta = current.score - previousScore;
    const delta = Math.round(rawDelta * 100) / 100;

    let direction: PillarDelta["direction"];
    if (delta > 0.01) {
      direction = "improved";
    } else if (delta < -0.01) {
      direction = "regressed";
    } else {
      direction = "unchanged";
    }

    const attribution = completedRecommendations
      .filter((r) => r.pillar === current.pillar)
      .map((r) => r.name);

    return {
      pillar: current.pillar,
      previousScore,
      currentScore: current.score,
      delta,
      direction,
      previousRiskLevel: prev?.riskLevel ?? "unknown",
      currentRiskLevel: current.riskLevel,
      attribution:
        attribution.length > 0 ? attribution : ["No new planning activity"],
    };
  });
}

// ---------------------------------------------------------------------------
// Server-side: getScoreDeltasForAssessment
// ---------------------------------------------------------------------------

/**
 * Load PillarScore rows for two assessments and compute deltas with
 * recommendation attribution (Pitfall 3: maps through ServiceRecommendation.category).
 */
export async function getScoreDeltasForAssessment(
  assessmentId: string,
  previousAssessmentId: string,
): Promise<PillarDelta[]> {
  const [currentScores, previousScores, completedRecs] = await Promise.all([
    prisma.pillarScore.findMany({
      where: { assessmentId },
      select: { pillar: true, score: true, riskLevel: true },
    }),
    prisma.pillarScore.findMany({
      where: { assessmentId: previousAssessmentId },
      select: { pillar: true, score: true, riskLevel: true },
    }),
    getCompletedRecommendationsForAttribution(
      assessmentId,
      previousAssessmentId,
    ),
  ]);

  return computePillarDeltas(previousScores, currentScores, completedRecs);
}

/**
 * Find completed recommendations between two assessments for attribution.
 * Maps through ServiceRecommendation.category to pillar (Pitfall 3).
 */
async function getCompletedRecommendationsForAttribution(
  _currentAssessmentId: string,
  previousAssessmentId: string,
): Promise<{ pillar: string; name: string }[]> {
  // Find the previous assessment's completedAt for time scoping
  const previousAssessment = await prisma.assessment.findUnique({
    where: { id: previousAssessmentId },
    select: { completedAt: true, userId: true },
  });

  if (!previousAssessment?.completedAt || !previousAssessment.userId) {
    return [];
  }

  // Find completed recommendations for this user after the previous assessment
  const recs = await prisma.assessmentRecommendation.findMany({
    where: {
      assessment: { userId: previousAssessment.userId },
      status: "COMPLETED",
      completedAt: { gte: previousAssessment.completedAt },
    },
    select: {
      serviceRecommendation: {
        select: { name: true, category: true },
      },
    },
  });

  return recs.map((r) => ({
    pillar: r.serviceRecommendation.category,
    name: r.serviceRecommendation.name,
  }));
}
