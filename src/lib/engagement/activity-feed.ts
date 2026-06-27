import "server-only";

import { prisma } from "@/lib/db";

export type ActivityFeedItem = {
  id: string;
  action: string;
  detail: unknown;
  createdAt: Date;
  actorId: string | null;
  recommendationName: string;
  recommendationId: string;
};

/**
 * Client-visible activity actions. Advisor-only actions (status_reviewed,
 * status_declined, etc.) are excluded from the CLIENT view per D-05.
 */
const CLIENT_VISIBLE_ACTIONS = [
  "milestone_update",
  "task_status_update",
  "auto_completed",
  "action_plan_published",
  "validation_requested",
  "milestone_blocked",
  "milestone_deferred",
];

type ActivityFeedInput = {
  clientId: string;
  limit?: number;
  offset?: number;
  role: "ADVISOR" | "CLIENT";
};

/**
 * Fetch a paginated, reverse-chronological activity feed scoped to one client.
 *
 * - Joins SolutionActivity -> AssessmentRecommendation -> Assessment -> userId
 * - ADVISOR role sees all actions; CLIENT role sees only client-visible actions
 * - Pagination via offset/limit (cursor-based offset)
 */
export async function getClientActivityFeed(
  input: ActivityFeedInput,
): Promise<ActivityFeedItem[]> {
  const { clientId, limit = 20, offset = 0, role } = input;

  const whereClause: Record<string, unknown> = {
    assessmentRecommendation: {
      assessment: {
        userId: clientId,
        status: "COMPLETED",
      },
    },
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

  return activities.map((a) => ({
    id: a.id,
    action: a.action,
    detail: a.detail,
    createdAt: a.createdAt,
    actorId: a.actorId,
    recommendationName:
      a.assessmentRecommendation.serviceRecommendation?.name ?? "Unknown",
    recommendationId: a.assessmentRecommendation.id,
  }));
}
