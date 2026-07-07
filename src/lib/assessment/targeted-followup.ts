import "server-only";

import { prisma } from "@/lib/db";

/**
 * Condition type from RecommendationRule.triggerConditions JSON.
 * Only answer_match and missing_control conditions have questionId.
 */
type RecommendationCondition = {
  type: string;
  questionId?: string;
  operator?: string;
  value?: unknown;
  weight?: number;
};

/**
 * Extract question IDs from completed recommendation trigger conditions (D-03).
 *
 * Algorithm (RESEARCH Pattern 5):
 * 1. Find COMPLETED AssessmentRecommendation rows for the assessment
 * 2. Load linked ServiceRecommendation -> RecommendationRule (isActive: true)
 * 3. Extract questionId from conditions of type "answer_match" or "missing_control"
 * 4. Deduplicate
 *
 * These are the questions to re-ask in a targeted follow-up reassessment.
 */
export async function getTargetedFollowupQuestions(
  assessmentId: string,
): Promise<string[]> {
  const completedRecs = await prisma.assessmentRecommendation.findMany({
    where: {
      assessmentId,
      status: "COMPLETED",
    },
    include: {
      serviceRecommendation: {
        include: {
          recommendationRules: {
            where: { isActive: true },
            select: { triggerConditions: true },
          },
        },
      },
    },
  });

  const questionIds = new Set<string>();

  for (const rec of completedRecs) {
    for (const rule of rec.serviceRecommendation.recommendationRules) {
      const conditions = rule.triggerConditions as RecommendationCondition[];
      if (!Array.isArray(conditions)) continue;

      for (const cond of conditions) {
        if (
          (cond.type === "answer_match" || cond.type === "missing_control") &&
          cond.questionId
        ) {
          questionIds.add(cond.questionId);
        }
      }
    }
  }

  return Array.from(questionIds);
}

/**
 * Count of eligible targeted follow-up questions for a given assessment.
 * Used by UI for the count badge and disabled state (Pitfall 4).
 */
export async function getTargetedQuestionCount(
  assessmentId: string,
): Promise<number> {
  const questions = await getTargetedFollowupQuestions(assessmentId);
  return questions.length;
}
