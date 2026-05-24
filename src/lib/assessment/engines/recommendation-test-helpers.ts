/**
 * Test helpers for recommendation engine happy-path scenarios.
 */

import type { Question } from "../types";
import { getVisibleQuestions } from "../branching";
import { buildLowestMaturityAnswers } from "../lowest-maturity-answers";
import { calculatePillarScore } from "../scoring";
import { normalizePillarSlug, pillarDefinitionFor } from "../pillar-registry";
import {
  belvedereAllAssessmentQuestions,
  belvedereFamilyGovernancePillar,
  belvedereQuestionsForPillar,
} from "../test-fixtures/belvedere-pillar-questions";
import type { CatalogRule, CatalogService } from "./recommendation-catalog-fixtures";

export { buildLowestMaturityAnswers };

export function questionsForPillar(pillarId: string): Question[] {
  return belvedereQuestionsForPillar(normalizePillarSlug(pillarId));
}

/** Lowest-maturity answers for one pillar’s UI question bank (respects branching). */
export function buildAllNoVisiblePillarAnswers(pillarId: string): {
  answers: Record<string, unknown>;
  visibleIds: string[];
  questions: Question[];
} {
  const questions = questionsForPillar(pillarId);
  const seed = buildLowestMaturityAnswers(questions, questions.map((q) => q.id));
  const visibleIds = getVisibleQuestions(seed, questions).map((q) => q.id);
  const answers = buildLowestMaturityAnswers(questions, visibleIds);
  return { answers, visibleIds, questions };
}

export function scorePillar(
  pillarId: string,
  answers: Record<string, unknown>,
  visibleIds: string[],
  questions?: Question[]
) {
  const qs = questions ?? questionsForPillar(pillarId);
  const pillar = pillarDefinitionFor(pillarId);
  return calculatePillarScore(answers, pillar, qs, visibleIds);
}

/** Visible family-governance answers with every yes-no gate answered "no". */
export function buildAllNoVisibleFamilyAnswers(): {
  answers: Record<string, unknown>;
  visibleIds: string[];
} {
  const answers = buildLowestMaturityAnswers(
    belvedereAllAssessmentQuestions,
    belvedereAllAssessmentQuestions.map((q) => q.id)
  );
  const visibleIds = getVisibleQuestions(answers, belvedereAllAssessmentQuestions).map(
    (q) => q.id
  );
  const visibleAnswers = buildLowestMaturityAnswers(belvedereAllAssessmentQuestions, visibleIds);
  return { answers: visibleAnswers, visibleIds };
}

export function scoreFamilyGovernancePillar(
  answers: Record<string, unknown>,
  visibleIds: string[]
) {
  return calculatePillarScore(
    answers,
    belvedereFamilyGovernancePillar,
    belvedereAllAssessmentQuestions,
    visibleIds
  );
}

export function toPrismaCatalogMocks(
  services: CatalogService[],
  rules: CatalogRule[]
) {
  return {
    rules: rules.map((rule) => ({
      id: rule.id,
      serviceRecommendationId: rule.serviceRecommendationId,
      ruleName: rule.ruleName,
      description: null,
      triggerConditions: rule.triggerConditions,
      pillarThresholds: null,
      questionConditions: null,
      priority: rule.priority,
      isActive: true,
    })),
    services: services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      category: service.category,
      priority: service.priority,
      estimatedCost: service.estimatedCost ?? null,
      timeframe: service.timeframe ?? null,
      provider: service.provider ?? null,
      metadata: null,
      isActive: true,
      tier: "BASELINE",
      complexity: "MEDIUM",
      implementationType: "ADVISORY",
    })),
  };
}
