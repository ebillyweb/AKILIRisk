import { getVisibleQuestions } from "./branching";
import { buildLowestMaturityAnswers } from "./lowest-maturity-answers";
import { normalizePillarSlug } from "./pillar-registry";
import {
  GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
} from "./pillar-outcome-expectations";
import type { Question, ScoreResult } from "./types";

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
  if (normalized !== "governance") {
    return [];
  }

  if (score.riskLevel !== "critical") {
    return [];
  }

  if (!allVisibleAnswersAtLowestChoice(answers, questions)) {
    return [];
  }

  return [...GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS];
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
