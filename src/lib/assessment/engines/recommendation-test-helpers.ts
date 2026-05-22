/**
 * Test helpers for recommendation engine happy-path scenarios.
 */

import type { Question } from "../types";
import { getVisibleQuestions } from "../branching";
import { calculatePillarScore } from "../scoring";
import { familyGovernancePillar, allQuestions } from "../questions";
import type { CatalogRule, CatalogService } from "./recommendation-catalog-fixtures";

/** Pick the lowest-maturity option for each visible question (yes-no → "no"). */
export function buildLowestMaturityAnswers(
  questions: Question[],
  visibleIds: string[]
): Record<string, unknown> {
  const visible = new Set(visibleIds);
  const answers: Record<string, unknown> = {};

  for (const question of questions) {
    if (!visible.has(question.id)) continue;

    if (question.type === "yes-no") {
      answers[question.id] = "no";
      continue;
    }

    if (question.type === "maturity-scale" && question.options?.length) {
      let worst = question.options[0];
      let worstScore = Number(question.scoreMap[String(worst.value)] ?? Infinity);
      for (const opt of question.options) {
        const raw = Number(question.scoreMap[String(opt.value)] ?? Infinity);
        if (raw < worstScore) {
          worst = opt;
          worstScore = raw;
        }
      }
      answers[question.id] = worst.value;
      continue;
    }

    if (question.options?.length) {
      let worst = question.options[0];
      let worstScore = Number(question.scoreMap[String(worst.value)] ?? Infinity);
      for (const opt of question.options) {
        const raw = Number(question.scoreMap[String(opt.value)] ?? Infinity);
        if (raw < worstScore) {
          worst = opt;
          worstScore = raw;
        }
      }
      answers[question.id] = worst.value;
    }
  }

  return answers;
}

/** Visible family-governance answers with every yes-no gate answered "no". */
export function buildAllNoVisibleFamilyAnswers(): {
  answers: Record<string, unknown>;
  visibleIds: string[];
} {
  const answers = buildLowestMaturityAnswers(allQuestions, allQuestions.map((q) => q.id));
  const visibleIds = getVisibleQuestions(answers, allQuestions).map((q) => q.id);
  const visibleAnswers = buildLowestMaturityAnswers(allQuestions, visibleIds);
  return { answers: visibleAnswers, visibleIds };
}

export function scoreFamilyGovernancePillar(
  answers: Record<string, unknown>,
  visibleIds: string[]
) {
  return calculatePillarScore(answers, familyGovernancePillar, allQuestions, visibleIds);
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
