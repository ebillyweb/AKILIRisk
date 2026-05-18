import "server-only";

import { prisma } from "@/lib/db";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations-health";
import type { HealthStatus } from "@/lib/admin/operations-health";
import type { MetricStatus } from "@/components/admin/dashboard/MetricCard";
import type {
  ControlCenterMetrics,
  MetricTrend,
} from "@/lib/admin/control-center-types";

export type { ControlCenterMetrics, MetricTrend } from "@/lib/admin/control-center-types";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

function formatCountDelta(current: number, previous: number): MetricTrend {
  const delta = current - previous;
  if (delta === 0) return { value: "0", direction: "flat" };
  const sign = delta > 0 ? "+" : "";
  return {
    value: `${sign}${delta}`,
    direction: delta > 0 ? "up" : "down",
  };
}

function formatRateDelta(
  current: number | null,
  previous: number | null
): MetricTrend {
  if (current === null || previous === null) {
    return { value: "—", direction: "flat" };
  }
  const deltaPts = (current - previous) * 100;
  if (Math.abs(deltaPts) < 0.05) {
    return { value: "0%", direction: "flat" };
  }
  const sign = deltaPts > 0 ? "+" : "";
  return {
    value: `${sign}${deltaPts.toFixed(1)}%`,
    direction: deltaPts > 0 ? "up" : "down",
  };
}

function mapOverallToPlatform(overall: HealthStatus): {
  value: string;
  status: MetricStatus;
} {
  switch (overall) {
    case "healthy":
      return { value: "Operational", status: "healthy" };
    case "degraded":
      return { value: "Degraded", status: "warning" };
    case "down":
      return { value: "Outage", status: "critical" };
    default:
      return { value: "Unknown", status: "neutral" };
  }
}

function mapFailedCountToStatus(count: number): MetricStatus {
  if (count === 0) return "healthy";
  if (count <= 2) return "warning";
  return "critical";
}

/**
 * Aggregate metrics for `/admin` (AKILI Control Center).
 *
 * Admin-gated at the page layer. Returns counts and period-over-period
 * deltas only — no per-client identifiers.
 */
export async function getControlCenterMetrics(): Promise<ControlCenterMetrics> {
  const thirtyDaysAgo = daysAgo(30);
  const sixtyDaysAgo = daysAgo(60);

  const [
    activeAdvisors,
    newAdvisorsLast30d,
    newAdvisorsPrior30d,
    assessmentsInProgress,
    assessmentsStartedLast30d,
    assessmentsStartedPrior30d,
    activeClients,
    clientsWithSubmittedIntake,
    clientsExisted30dAgo,
    clientsWithIntakeBy30dAgo,
    pendingReviews,
    stalePendingReviews,
    healthSnapshot,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: "ADVISOR",
        deletedAt: null,
        advisorPortalAccessEnabled: true,
      },
    }),
    prisma.user.count({
      where: {
        role: "ADVISOR",
        deletedAt: null,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.user.count({
      where: {
        role: "ADVISOR",
        deletedAt: null,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
      },
    }),
    prisma.assessment.count({ where: { status: "IN_PROGRESS" } }),
    prisma.assessment.count({ where: { startedAt: { gte: thirtyDaysAgo } } }),
    prisma.assessment.count({
      where: { startedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
    prisma.user.count({ where: { role: "USER", deletedAt: null } }),
    prisma.user.count({
      where: {
        role: "USER",
        deletedAt: null,
        intakeInterviews: {
          some: { status: { in: ["SUBMITTED", "COMPLETED"] } },
        },
      },
    }),
    prisma.user.count({
      where: {
        role: "USER",
        deletedAt: null,
        createdAt: { lte: thirtyDaysAgo },
      },
    }),
    prisma.user.count({
      where: {
        role: "USER",
        deletedAt: null,
        createdAt: { lte: thirtyDaysAgo },
        intakeInterviews: {
          some: {
            status: { in: ["SUBMITTED", "COMPLETED"] },
            OR: [
              { submittedAt: { lte: thirtyDaysAgo } },
              { completedAt: { lte: thirtyDaysAgo } },
            ],
          },
        },
      },
    }),
    prisma.intakeApproval.count({
      where: { status: { in: ["PENDING", "IN_REVIEW"] } },
    }),
    prisma.intakeApproval.count({
      where: {
        status: { in: ["PENDING", "IN_REVIEW"] },
        createdAt: { lte: thirtyDaysAgo },
      },
    }),
    getOperationsHealthSnapshot(),
  ]);

  const currentIntakeRate =
    activeClients > 0 ? clientsWithSubmittedIntake / activeClients : null;
  const priorIntakeRate =
    clientsExisted30dAgo > 0
      ? clientsWithIntakeBy30dAgo / clientsExisted30dAgo
      : null;

  const failedCount = healthSnapshot.failedIntegrations.length;

  return {
    activeAdvisors: {
      value: activeAdvisors,
      trend: formatCountDelta(newAdvisorsLast30d, newAdvisorsPrior30d),
    },
    assessmentsInProgress: {
      value: assessmentsInProgress,
      trend: formatCountDelta(
        assessmentsStartedLast30d,
        assessmentsStartedPrior30d
      ),
    },
    intakeCompletionRate: {
      value:
        currentIntakeRate !== null
          ? `${Math.round(currentIntakeRate * 100)}%`
          : "—",
      trend: formatRateDelta(currentIntakeRate, priorIntakeRate),
    },
    platformStatus: mapOverallToPlatform(healthSnapshot.overall),
    failedIntegrations: {
      value: failedCount,
      status: mapFailedCountToStatus(failedCount),
    },
    pendingReviews: {
      value: pendingReviews,
      trend: formatCountDelta(pendingReviews, stalePendingReviews),
    },
  };
}
