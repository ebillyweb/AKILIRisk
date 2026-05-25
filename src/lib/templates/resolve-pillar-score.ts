import { prisma } from "@/lib/db";
import { normalizePillarScoreId } from "@/lib/assessment/pillar-registry";
import type { ScoreResult } from "@/lib/assessment/types";
import type { TemplateId } from "./types";

/** DB pillar slugs that may exist for a canonical template pillar. */
const PILLAR_SCORE_LOOKUP_CANDIDATES: Record<TemplateId, string[]> = {
  governance: ["governance", "family-governance", "identity-risk"],
  "cyber-digital": ["cyber-digital", "cyber-risk"],
  "physical-security": ["physical-security"],
  insurance: ["insurance"],
  "geographic-environmental": ["geographic-environmental"],
  "reputational-social": ["reputational-social"],
};

/**
 * Load persisted pillar score for a template's risk area, trying canonical
 * and legacy pillar slugs stored on older assessments.
 */
export async function loadPillarScoreForTemplate(
  assessmentId: string,
  templateId: TemplateId
): Promise<ScoreResult | null> {
  const candidates = PILLAR_SCORE_LOOKUP_CANDIDATES[templateId] ?? [templateId];

  for (const pillar of candidates) {
    const row = await prisma.pillarScore.findUnique({
      where: {
        assessmentId_pillar: { assessmentId, pillar },
      },
    });
    if (!row) continue;

    const normalized = normalizePillarScoreId(row.pillar);
    if (normalized !== templateId) continue;

    return {
      score: row.score,
      riskLevel: row.riskLevel.toLowerCase() as ScoreResult["riskLevel"],
      breakdown: (row.breakdown ?? []) as unknown as ScoreResult["breakdown"],
      missingControls: (row.missingControls ??
        []) as unknown as ScoreResult["missingControls"],
    };
  }

  return null;
}
