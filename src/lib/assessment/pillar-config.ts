import "server-only";

import { loadGovernanceQuestionsMerged } from "@/lib/assessment/bank/load-bank";
import { pillarDefinitionFor, normalizePillarSlug, isAssessmentPillarId } from "@/lib/assessment/pillar-registry";
import { allQuestions } from "@/lib/assessment/questions";
import type { Pillar, Question } from "@/lib/assessment/types";

export async function loadPillarQuestions(pillarId: string): Promise<Question[]> {
  const normalized = normalizePillarSlug(pillarId);
  if (!isAssessmentPillarId(normalized)) {
    return [];
  }

  const fromBank = await loadGovernanceQuestionsMerged({
    onlyVisible: true,
    riskAreaId: normalized,
  });
  if (fromBank.length > 0) {
    return fromBank;
  }

  return allQuestions.filter((q) => q.subCategory === normalized);
}

export async function getPillarAssessmentConfig(
  pillarId: string
): Promise<{ pillarData: Pillar; questions: Question[] } | null> {
  const normalized = normalizePillarSlug(pillarId);
  if (!isAssessmentPillarId(normalized)) {
    return null;
  }

  const questions = await loadPillarQuestions(normalized);
  return {
    pillarData: pillarDefinitionFor(normalized),
    questions,
  };
}
