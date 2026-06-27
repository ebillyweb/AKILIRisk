import "server-only";

import { prisma } from "@/lib/db";
import { subDays } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────

export type EngagementMetrics = {
  overallCompletionPct: number;
  activeClientCount: number;
  stalledClientCount: number;
  overdueMilestoneCount: number;
};

export type EngagementClientRow = {
  clientId: string;
  clientName: string;
  clientEmail: string;
  completionPct: number;
  completedCount: number;
  totalCount: number;
  lastActivityAt: Date | null;
  blockedCount: number;
  isStalled: boolean;
};

type UpcomingMilestone = {
  id: string;
  title: string;
  dueDate: Date;
  status: string;
  recommendationName: string;
  clientId: string;
  clientName: string;
};

// ── Constants ────────────────────────────────────────────────────────────

const STALLED_DAYS = 14;
const TERMINAL_STATUSES = ["COMPLETED", "SKIPPED", "DEFERRED"];

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Get aggregate engagement metrics for an advisor's portfolio.
 */
export async function getEngagementMetrics(
  advisorProfileId: string
): Promise<EngagementMetrics> {
  const stalledThreshold = subDays(new Date(), STALLED_DAYS);
  const now = new Date();

  // Get all active client assignments for this advisor
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: {
      advisorId: advisorProfileId,
      status: "ACTIVE",
    },
    select: {
      clientId: true,
    },
  });

  const clientIds = assignments.map((a) => a.clientId);
  if (clientIds.length === 0) {
    return {
      overallCompletionPct: 0,
      activeClientCount: 0,
      stalledClientCount: 0,
      overdueMilestoneCount: 0,
    };
  }

  // Get assessments with published action plans for these clients
  const assessments = await prisma.assessment.findMany({
    where: {
      userId: { in: clientIds },
      actionPlanPublishedAt: { not: null },
    },
    select: {
      id: true,
      userId: true,
      recommendations: {
        where: {
          hiddenFromClient: false,
          status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
        },
        select: {
          id: true,
          status: true,
          milestones: {
            select: {
              id: true,
              status: true,
              dueDate: true,
            },
          },
        },
      },
    },
  });

  if (assessments.length === 0) {
    return {
      overallCompletionPct: 0,
      activeClientCount: 0,
      stalledClientCount: 0,
      overdueMilestoneCount: 0,
    };
  }

  // Compute metrics
  let totalMilestones = 0;
  let completedMilestones = 0;
  let overdueMilestones = 0;
  const activeClientIds = new Set<string>();

  for (const assessment of assessments) {
    activeClientIds.add(assessment.userId);
    for (const rec of assessment.recommendations) {
      for (const ms of rec.milestones) {
        totalMilestones++;
        if (TERMINAL_STATUSES.includes(ms.status)) {
          completedMilestones++;
        }
        if (
          ms.dueDate &&
          ms.dueDate < now &&
          !TERMINAL_STATUSES.includes(ms.status) &&
          ms.status !== "BLOCKED"
        ) {
          overdueMilestones++;
        }
      }
    }
  }

  // Stalled detection: clients with no recent activity and IN_PROGRESS recommendations
  const activeAssessmentIds = assessments.map((a) => a.id);
  const recentActivities = await prisma.solutionActivity.groupBy({
    by: ["assessmentRecommendationId"],
    where: {
      assessmentRecommendation: {
        assessmentId: { in: activeAssessmentIds },
      },
      createdAt: { gte: stalledThreshold },
    },
    _max: { createdAt: true },
  });

  const activeRecIds = new Set(
    recentActivities.map((a) => a.assessmentRecommendationId)
  );

  let stalledCount = 0;
  const clientRecMap = new Map<string, string[]>();
  for (const assessment of assessments) {
    const recs = assessment.recommendations
      .filter((r) => r.status === "IN_PROGRESS")
      .map((r) => r.id);
    if (recs.length > 0) {
      clientRecMap.set(assessment.userId, [
        ...(clientRecMap.get(assessment.userId) ?? []),
        ...recs,
      ]);
    }
  }

  for (const [_clientId, recIds] of clientRecMap) {
    const hasRecentActivity = recIds.some((id) => activeRecIds.has(id));
    if (!hasRecentActivity) {
      stalledCount++;
    }
  }

  return {
    overallCompletionPct:
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0,
    activeClientCount: activeClientIds.size,
    stalledClientCount: stalledCount,
    overdueMilestoneCount: overdueMilestones,
  };
}

/**
 * Get per-client engagement data for the dashboard table.
 */
export async function getEngagementClients(
  advisorProfileId: string,
  filter?: "all" | "stalled"
): Promise<EngagementClientRow[]> {
  const stalledThreshold = subDays(new Date(), STALLED_DAYS);

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: {
      advisorId: advisorProfileId,
      status: "ACTIVE",
    },
    select: {
      clientId: true,
      client: {
        select: {
          name: true,
          assessments: {
            where: { actionPlanPublishedAt: { not: null } },
            select: {
              id: true,
              recommendations: {
                where: {
                  hiddenFromClient: false,
                  status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
                },
                select: {
                  id: true,
                  status: true,
                  milestones: {
                    select: { status: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const rows: EngagementClientRow[] = [];

  for (const assign of assignments) {
    const client = assign.client;
    const publishedAssessments = client.assessments;

    if (publishedAssessments.length === 0) continue;

    let totalMs = 0;
    let completedMs = 0;
    let blockedMs = 0;
    const recIds: string[] = [];

    for (const assessment of publishedAssessments) {
      for (const rec of assessment.recommendations) {
        recIds.push(rec.id);
        for (const ms of rec.milestones) {
          totalMs++;
          if (TERMINAL_STATUSES.includes(ms.status)) completedMs++;
          if (ms.status === "BLOCKED") blockedMs++;
        }
      }
    }

    // Get last activity
    const lastActivity = await prisma.solutionActivity.findFirst({
      where: {
        assessmentRecommendationId: { in: recIds },
      },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const isStalled =
      recIds.length > 0 &&
      (!lastActivity || lastActivity.createdAt < stalledThreshold);

    if (filter === "stalled" && !isStalled) continue;

    rows.push({
      clientId: assign.clientId,
      clientName: client.name ?? "Unknown",
      clientEmail: "",
      completionPct:
        totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0,
      completedCount: completedMs,
      totalCount: totalMs,
      lastActivityAt: lastActivity?.createdAt ?? null,
      blockedCount: blockedMs,
      isStalled,
    });
  }

  return rows;
}

/**
 * Get milestones due within the next N days for an advisor's clients.
 */
export async function getUpcomingMilestones(
  advisorProfileId: string,
  daysAhead = 30
): Promise<UpcomingMilestone[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const milestones = await prisma.solutionMilestone.findMany({
    where: {
      dueDate: { gte: now, lte: cutoff },
      status: { notIn: ["COMPLETED", "SKIPPED", "DEFERRED"] },
      assessmentRecommendation: {
        hiddenFromClient: false,
        assessment: {
          actionPlanPublishedAt: { not: null },
          user: {
            clientAssignments: {
              some: {
                advisorId: advisorProfileId,
                status: "ACTIVE",
              },
            },
          },
        },
      },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
      assessmentRecommendation: {
        select: {
          serviceRecommendation: { select: { name: true } },
          assessment: {
            select: {
              userId: true,
              user: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  return milestones.map((ms) => ({
    id: ms.id,
    title: ms.title,
    dueDate: ms.dueDate!,
    status: ms.status,
    recommendationName:
      ms.assessmentRecommendation.serviceRecommendation?.name ?? "Unknown",
    clientId: ms.assessmentRecommendation.assessment.userId,
    clientName:
      ms.assessmentRecommendation.assessment.user.name ?? "Unknown",
  }));
}

/**
 * Lightweight query for the portfolio engagement column (D-07).
 * Returns data only for clients with published action plans.
 * Clients without published plans are not in the map (UI renders "--").
 */
export async function getPortfolioEngagementData(
  advisorProfileId: string
): Promise<Map<string, { completedCount: number; totalCount: number; blockedCount: number }>> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: {
      advisorId: advisorProfileId,
      status: "ACTIVE",
    },
    select: {
      clientId: true,
      client: {
        select: {
          assessments: {
            where: { actionPlanPublishedAt: { not: null } },
            select: {
              recommendations: {
                where: {
                  hiddenFromClient: false,
                  status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
                },
                select: {
                  milestones: {
                    select: { status: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const result = new Map<
    string,
    { completedCount: number; totalCount: number; blockedCount: number }
  >();

  for (const assign of assignments) {
    const publishedAssessments = assign.client.assessments;
    if (publishedAssessments.length === 0) continue;

    let total = 0;
    let completed = 0;
    let blocked = 0;

    for (const assessment of publishedAssessments) {
      for (const rec of assessment.recommendations) {
        for (const ms of rec.milestones) {
          total++;
          if (TERMINAL_STATUSES.includes(ms.status)) completed++;
          if (ms.status === "BLOCKED") blocked++;
        }
      }
    }

    result.set(assign.clientId, {
      completedCount: completed,
      totalCount: total,
      blockedCount: blocked,
    });
  }

  return result;
}
