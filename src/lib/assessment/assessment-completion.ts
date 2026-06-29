import type { Prisma } from "@prisma/client";
import { normalizePillarScoreId } from "@/lib/assessment/pillar-registry";
import { isAssessmentScopeComplete } from "@/lib/assessment/included-pillars";
import { enterPreview } from "@/lib/assessment/deliverable-phase";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";

type Tx = Prisma.TransactionClient;

/**
 * Mark the assessment COMPLETED only when every **included** pillar has a
 * PillarScore row. Otherwise keep (or reset to) IN_PROGRESS.
 *
 * Epic 5.11: scope comes from `Assessment.includedPillars` (empty = all six).
 * BRD §6.3 / Epic 5.10: when scope is complete, stamp PREVIEW for the heat-map
 * overview and the 48-hour advisory-outreach clock.
 */
export async function syncAssessmentCompletionStatus(
  tx: Tx,
  assessmentId: string
): Promise<{ allPillarsScored: boolean }> {
  const assessment = await tx.assessment.findUnique({
    where: { id: assessmentId },
    select: { includedPillars: true, status: true },
  });
  if (!assessment) {
    return { allPillarsScored: false };
  }
  // ARCHIVED is terminal — re-scoring must not silently flip it back to
  // COMPLETED/IN_PROGRESS or reset completedAt.
  if (assessment.status === "ARCHIVED") {
    return { allPillarsScored: false };
  }

  const scored = await tx.pillarScore.findMany({
    where: { assessmentId },
    select: { pillar: true },
  });

  const scoredIds = scored.map((s) => normalizePillarScoreId(s.pillar));
  const catalog = await getPlatformPillarCatalog();
  const allPillarsScored = isAssessmentScopeComplete(
    scoredIds,
    assessment.includedPillars,
    catalog,
  );

  const now = new Date();
  await tx.assessment.update({
    where: { id: assessmentId },
    data: allPillarsScored
      ? { status: "COMPLETED", completedAt: now }
      : { status: "IN_PROGRESS", completedAt: null },
  });

  if (allPillarsScored) {
    await enterPreview(tx, assessmentId, now);
  }

  return { allPillarsScored };
}

/** Build pillarScores map for the recommendation engine from persisted rows. */
export function pillarScoresRecordFromRows(
  rows: Array<{ pillar: string; score: number; riskLevel: string }>
): Record<string, { score: number; riskLevel: "low" | "medium" | "high" | "critical" }> {
  const out: Record<string, { score: number; riskLevel: "low" | "medium" | "high" | "critical" }> =
    {};
  for (const row of rows) {
    const id = normalizePillarScoreId(row.pillar);
    out[id] = {
      score: row.score,
      riskLevel: row.riskLevel.toLowerCase() as "low" | "medium" | "high" | "critical",
    };
  }
  return out;
}
