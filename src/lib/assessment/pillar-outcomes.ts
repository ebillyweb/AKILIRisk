import { getVisibleQuestions } from "./branching";
import { buildLowestMaturityAnswers } from "./lowest-maturity-answers";
import { normalizePillarSlug } from "./pillar-registry";
import {
  CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
} from "./pillar-outcome-expectations";
import type { Question, ScoreResult } from "./types";

const ALL_NEGATIVE_NARRATIVES_BY_PILLAR: Partial<
  Record<string, readonly string[]>
> = {
  governance: GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "cyber-digital": CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "physical-security": PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  insurance: INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "geographic-environmental": GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  "reputational-social": REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
};

/**
 * Pillar-level narrative recommendations shown when every visible answer is at the
 * lowest maturity choice for that pillar (e.g. every governance gate answered "no").
 */
export function pillarNarrativeRecommendations(
  pillarId: string,
  score: ScoreResult,
  answers: Record<string, unknown>,
  questions: Question[]
): string[] {
  const normalized = normalizePillarSlug(pillarId);
  const narratives = ALL_NEGATIVE_NARRATIVES_BY_PILLAR[normalized];
  if (!narratives) {
    return [];
  }

  if (score.riskLevel !== "critical") {
    return [];
  }

  if (!allVisibleAnswersAtLowestChoice(answers, questions)) {
    return [];
  }

  return [...narratives];
}

function allVisibleAnswersAtLowestChoice(
  answers: Record<string, unknown>,
  questions: Question[]
): boolean {
  const visibleIds = getVisibleQuestions(answers, questions).map((q) => q.id);
  const expected = buildLowestMaturityAnswers(questions, visibleIds);

  for (const id of visibleIds) {
    if (answers[id] !== expected[id]) {
      return false;
    }
  }

  return visibleIds.length > 0;
}
