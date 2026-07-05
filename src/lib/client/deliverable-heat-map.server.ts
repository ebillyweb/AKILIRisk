import "server-only";

import type { AssessmentStatus } from "@prisma/client";
import type { PillarScoreInput } from "@/lib/assessment/heat-map-data";
import {
  isNarrowAssessmentScope,
} from "@/lib/assessment/included-pillars";
import { normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { calculateWeightedScoreFromPillars } from "@/lib/analytics/queries";
import type { PillarCatalogEntry } from "@/lib/methodology/pillar-catalog";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import { prisma } from "@/lib/db";

const RISK_LEVEL_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function resolveScopedAssessmentMetrics(
  pillarScores: ReadonlyArray<PillarScoreInput>,
): { score: number | null; riskLevel: string | null } {
  if (pillarScores.length === 0) {
    return { score: null, riskLevel: null };
  }

  const score = Math.round(
    calculateWeightedScoreFromPillars(
      pillarScores.map((row) => ({ pillar: row.pillar, score: row.score })),
    ) * 100,
  ) / 100;

  let riskLevel: string | null = null;
  let maxRank = 0;
  for (const row of pillarScores) {
    const rank = RISK_LEVEL_RANK[row.riskLevel?.toUpperCase() ?? ""] ?? 0;
    if (rank > maxRank) {
      maxRank = rank;
      riskLevel = row.riskLevel ?? null;
    }
  }

  return { score, riskLevel };
}

export type DeliverableHeatMapData = {
  pillarScores: PillarScoreInput[];
  catalog: readonly PillarCatalogEntry[];
  includedPillarIds?: readonly string[];
  status: AssessmentStatus;
  score: number | null;
  riskLevel: string | null;
  completedAt: Date | null;
};

export async function loadDeliverableHeatMapData(
  assessmentId: string,
  includedPillars: readonly string[],
): Promise<DeliverableHeatMapData> {
  const [pillarScores, catalog, assessment] = await Promise.all([
    prisma.pillarScore.findMany({
      where: { assessmentId },
      select: { pillar: true, score: true, riskLevel: true },
      orderBy: { pillar: "asc" },
    }),
    getPlatformPillarCatalog(),
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { status: true, completedAt: true },
    }),
  ]);

  const includedSet = new Set(includedPillars.map(normalizePillarSlug));
  const scopedScores = pillarScores.filter((row) =>
    includedSet.has(normalizePillarSlug(row.pillar)),
  );
  const narrowScope = isNarrowAssessmentScope(includedPillars, catalog);
  const { score, riskLevel } = resolveScopedAssessmentMetrics(scopedScores);

  return {
    pillarScores: scopedScores,
    catalog,
    includedPillarIds: narrowScope ? includedPillars : undefined,
    status: assessment?.status ?? "IN_PROGRESS",
    score,
    riskLevel,
    completedAt: assessment?.completedAt ?? null,
  };
}
