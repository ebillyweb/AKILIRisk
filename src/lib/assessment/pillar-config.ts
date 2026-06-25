import "server-only";

import { loadGovernanceQuestionsMerged } from "@/lib/assessment/bank/load-bank";
import { pillarDefinitionFor, normalizePillarSlug, isAssessmentPillarId } from "@/lib/assessment/pillar-registry";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";
import type { Pillar, Question } from "@/lib/assessment/types";

export async function loadPillarQuestions(pillarId: string): Promise<Question[]> {
  const catalog = await getPlatformPillarCatalog();
  const normalized = normalizePillarSlug(pillarId);
  if (!isAssessmentPillarId(normalized, catalog)) {
    return [];
  }

  const fromBank = await loadGovernanceQuestionsMerged({
    onlyVisible: true,
    riskAreaId: normalized,
  });
  return fromBank;
}

export async function getPillarAssessmentConfig(
  pillarId: string
): Promise<{ pillarData: Pillar; questions: Question[] } | null> {
  const catalog = await getPlatformPillarCatalog();
  const normalized = normalizePillarSlug(pillarId);
  if (!isAssessmentPillarId(normalized, catalog)) {
    return null;
  }

  const questions = await loadPillarQuestions(normalized);
  return {
    pillarData: pillarDefinitionFor(normalized, catalog),
    questions,
  };
}
