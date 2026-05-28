import type { Prisma } from "@prisma/client";
import {
  ASSESSMENT_PILLAR_IDS,
  normalizePillarScoreId,
} from "@/lib/assessment/pillar-registry";
import { enterPreview } from "@/lib/assessment/deliverable-phase";

type Tx = Prisma.TransactionClient;

/**
 * Mark the assessment COMPLETED only when every canonical pillar has a
 * PillarScore row. Otherwise keep (or reset to) IN_PROGRESS.
 *
 * BRD §6.3 / Epic 5.10: when all pillars are scored, also stamp the
 * deliverable phase as PREVIEW so the client can view the heat-map
 * overview and the 48-hour advisory-outreach clock starts.
 */
export async function syncAssessmentCompletionStatus(
  tx: Tx,
  assessmentId: string
): Promise<{ allPillarsScored: boolean }> {
  const scored = await tx.pillarScore.findMany({
    where: { assessmentId },
    select: { pillar: true },
  });

  const scoredIds = new Set(scored.map((s) => normalizePillarScoreId(s.pillar)));
  const allPillarsScored = ASSESSMENT_PILLAR_IDS.every((id) => scoredIds.has(id));

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
