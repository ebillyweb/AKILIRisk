import { getVisibleQuestions } from "./branching";
import { buildHighestMaturityAnswers } from "./highest-maturity-answers";
import { buildLowestMaturityAnswers } from "./lowest-maturity-answers";
import { normalizePillarSlug } from "./pillar-registry";
import {
  CYBER_DIGITAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GEOGRAPHIC_ENVIRONMENTAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GEOGRAPHIC_ENVIRONMENTAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  CYBER_DIGITAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  INSURANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  INSURANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  PHYSICAL_SECURITY_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  PHYSICAL_SECURITY_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  REPUTATIONAL_SOCIAL_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  REPUTATIONAL_SOCIAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
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

const ALL_YES_NARRATIVES_BY_PILLAR: Partial<Record<string, readonly string[]>> = {
  governance: GOVERNANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "cyber-digital": CYBER_DIGITAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "physical-security": PHYSICAL_SECURITY_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  insurance: INSURANCE_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "geographic-environmental": GEOGRAPHIC_ENVIRONMENTAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
  "reputational-social": REPUTATIONAL_SOCIAL_ALL_YES_NARRATIVE_RECOMMENDATIONS,
};

/**
 * Pillar-level narrative recommendations for extreme maturity bands:
 * critical + all lowest choices, or low + all highest choices (e.g. all “yes”).
 */
export function pillarNarrativeRecommendations(
  pillarId: string,
  score: ScoreResult,
  answers: Record<string, unknown>,
  questions: Question[]
): string[] {
  const normalized = normalizePillarSlug(pillarId);

  const negative = ALL_NEGATIVE_NARRATIVES_BY_PILLAR[normalized];
  if (
    negative &&
    score.riskLevel === "critical" &&
    allVisibleAnswersMatchBand(answers, questions, "lowest")
  ) {
    return [...negative];
  }

  const positive = ALL_YES_NARRATIVES_BY_PILLAR[normalized];
  if (
    positive &&
    score.riskLevel === "low" &&
    allVisibleAnswersMatchBand(answers, questions, "highest")
  ) {
    return [...positive];
  }

  return [];
}

function allVisibleAnswersMatchBand(
  answers: Record<string, unknown>,
  questions: Question[],
  band: "lowest" | "highest"
): boolean {
  const visibleIds = getVisibleQuestions(answers, questions).map((q) => q.id);
  const expected =
    band === "lowest"
      ? buildLowestMaturityAnswers(questions, visibleIds)
      : buildHighestMaturityAnswers(questions, visibleIds);

  for (const id of visibleIds) {
    if (answers[id] !== expected[id]) {
      return false;
    }
  }

  return visibleIds.length > 0;
}
