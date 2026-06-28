import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// Intelligence event action constants (D-12)
// ---------------------------------------------------------------------------

export const INTELLIGENCE_ACTIONS = {
  // Assessment events
  ASSESSMENT_STARTED: "assessment_started",
  ASSESSMENT_COMPLETED: "assessment_completed",
  SCORE_CALCULATED: "score_calculated",
  REASSESSMENT_TRIGGERED: "reassessment_triggered",
  // Score change events
  PILLAR_SCORE_DELTA: "pillar_score_delta",
  RISK_LEVEL_TRANSITION: "risk_level_transition",
  // Cadence events
  CADENCE_DUE_APPROACHING: "cadence_due_approaching",
  CADENCE_OVERDUE: "cadence_overdue",
  CADENCE_CHANGED: "cadence_changed",
  CADENCE_SYSTEM_RECOMMENDED: "cadence_system_recommended",
  // Recommendation impact events
  RECOMMENDATION_IMPACT_MEASURED: "recommendation_impact_measured",
  COMPLETION_MILESTONE_REACHED: "completion_milestone_reached",
} as const;

export type IntelligenceAction =
  (typeof INTELLIGENCE_ACTIONS)[keyof typeof INTELLIGENCE_ACTIONS];

// ---------------------------------------------------------------------------
// Client-visible subset (merged with CLIENT_VISIBLE_ACTIONS in Plan 03)
// ---------------------------------------------------------------------------

export const CLIENT_VISIBLE_INTELLIGENCE_ACTIONS: IntelligenceAction[] = [
  INTELLIGENCE_ACTIONS.ASSESSMENT_COMPLETED,
  INTELLIGENCE_ACTIONS.SCORE_CALCULATED,
  INTELLIGENCE_ACTIONS.PILLAR_SCORE_DELTA,
  INTELLIGENCE_ACTIONS.RISK_LEVEL_TRANSITION,
  INTELLIGENCE_ACTIONS.COMPLETION_MILESTONE_REACHED,
];

// ---------------------------------------------------------------------------
// Intelligence event logging helper
// ---------------------------------------------------------------------------

type LogIntelligenceEventParams = {
  tx?: Prisma.TransactionClient;
  action: string;
  assessmentId?: string;
  assessmentRecommendationId?: string;
  actorId?: string;
  detail?: Record<string, unknown>;
};

/**
 * Log an intelligence event as a SolutionActivity row.
 *
 * At least one of `assessmentId` or `assessmentRecommendationId` must be
 * provided. Uses the nullable `assessmentId` FK from the Plan 01 migration
 * for assessment-scoped events that have no recommendation.
 */
export async function logIntelligenceEvent(
  params: LogIntelligenceEventParams,
): Promise<void> {
  const { tx, action, assessmentId, assessmentRecommendationId, actorId, detail } = params;

  if (!assessmentId && !assessmentRecommendationId) {
    throw new Error(
      "logIntelligenceEvent requires at least one of assessmentId or assessmentRecommendationId",
    );
  }

  const client = tx ?? prisma;

  await client.solutionActivity.create({
    data: {
      action,
      ...(assessmentId ? { assessmentId } : {}),
      ...(assessmentRecommendationId ? { assessmentRecommendationId } : {}),
      ...(actorId ? { actorId } : {}),
      detail: detail ?? {},
    },
  });
}
