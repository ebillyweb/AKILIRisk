import "server-only";

import { prisma } from "@/lib/db";
import { CLIENT_VISIBLE_INTELLIGENCE_ACTIONS } from "@/lib/engagement/intelligence-events";

export type ActivityFeedItem = {
  id: string;
  action: string;
  detail: unknown;
  createdAt: Date;
  actorId: string | null;
  recommendationName: string;
  recommendationId: string | null;
  /** Discriminator for UI rendering: recommendation-based vs intelligence events. */
  eventType: "recommendation" | "intelligence";
};

/**
 * Client-visible activity actions. Advisor-only actions (status_reviewed,
 * status_declined, etc.) are excluded from the CLIENT view per D-05.
 *
 * Merged with CLIENT_VISIBLE_INTELLIGENCE_ACTIONS from Phase 24.
 */
const CLIENT_VISIBLE_ACTIONS: string[] = [
  "milestone_update",
  "task_status_update",
  "auto_completed",
  "action_plan_published",
  "validation_requested",
  "milestone_blocked",
  "milestone_deferred",
  ...CLIENT_VISIBLE_INTELLIGENCE_ACTIONS,
];

/**
 * Map intelligence event action types to human-readable labels
 * for the recommendationName field when no recommendation exists.
 */
const INTELLIGENCE_ACTION_LABELS: Record<string, string> = {
  assessment_started: "Assessment started",
  assessment_completed: "Assessment completed",
  score_calculated: "Score calculated",
  reassessment_triggered: "Reassessment triggered",
  pillar_score_delta: "Score change",
  risk_level_transition: "Risk level change",
  cadence_due_approaching: "Review due soon",
  cadence_overdue: "Review overdue",
  cadence_changed: "Review cadence updated",
  cadence_system_recommended: "System reassessment recommendation",
  recommendation_impact_measured: "Recommendation impact measured",
  completion_milestone_reached: "Completion milestone reached",
};

type ActivityFeedInput = {
  clientId: string;
  limit?: number;
  offset?: number;
  role: "ADVISOR" | "CLIENT";
};

/**
 * Fetch a paginated, reverse-chronological activity feed scoped to one client.
 *
 * Supports two kinds of SolutionActivity rows:
 * 1. Recommendation-based: assessmentRecommendationId is set (Phase 23 pattern)
 * 2. Intelligence events: assessmentId is set, assessmentRecommendationId may be null (Phase 24)
 *
 * Uses an OR condition so both kinds are returned in a single query.
 * Backward compatible: all existing recommendation-based items continue unchanged.
 */
export async function getClientActivityFeed(
  input: ActivityFeedInput,
): Promise<ActivityFeedItem[]> {
  const { clientId, limit = 20, offset = 0, role } = input;

  // Build the OR condition to handle both recommendation-based and intelligence events
  const orConditions = [
    // Recommendation-based events (existing pattern)
    {
      assessmentRecommendation: {
        assessment: {
          userId: clientId,
          status: "COMPLETED",
        },
      },
    },
    // Intelligence events with assessmentId but no assessmentRecommendationId
    {
      assessmentRecommendationId: null,
      assessment: {
        userId: clientId,
      },
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause: Record<string, any> = {
    OR: orConditions,
  };

  // CLIENT role: restrict to client-visible action types per D-05
  if (role === "CLIENT") {
    whereClause.action = { in: CLIENT_VISIBLE_ACTIONS };
  }

  const activities = await prisma.solutionActivity.findMany({
    where: whereClause,
    include: {
      assessmentRecommendation: {
        select: {
          id: true,
          serviceRecommendation: {
            select: { name: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  return activities.map((a) => {
    const isIntelligence = !a.assessmentRecommendationId;

    return {
      id: a.id,
      action: a.action,
      detail: a.detail,
      createdAt: a.createdAt,
      actorId: a.actorId,
      recommendationName: isIntelligence
        ? (INTELLIGENCE_ACTION_LABELS[a.action] ?? a.action)
        : (a.assessmentRecommendation?.serviceRecommendation?.name ?? "Unknown"),
      recommendationId: a.assessmentRecommendation?.id ?? null,
      eventType: isIntelligence ? "intelligence" : "recommendation",
    };
  });
}
