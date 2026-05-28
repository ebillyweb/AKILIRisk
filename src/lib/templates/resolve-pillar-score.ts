import { prisma } from "@/lib/db";
import type { ScoreResult } from "@/lib/assessment/types";
import type { TemplateId } from "./types";

/**
 * Load the persisted pillar score for a template's risk area. Pre-launch we
 * have no legacy data, so this looks up the canonical pillar slug directly.
 */
export async function loadPillarScoreForTemplate(
  assessmentId: string,
  templateId: TemplateId
): Promise<ScoreResult | null> {
  const row = await prisma.pillarScore.findUnique({
    where: {
      assessmentId_pillar: { assessmentId, pillar: templateId },
    },
  });
  if (!row) return null;

  return {
    score: row.score,
    riskLevel: row.riskLevel.toLowerCase() as ScoreResult["riskLevel"],
    breakdown: (row.breakdown ?? []) as unknown as ScoreResult["breakdown"],
    missingControls: (row.missingControls ??
      []) as unknown as ScoreResult["missingControls"],
  };
}
