import "server-only";

import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import type { ControlCenterAlert } from "@/lib/admin/control-center-types";
import type { AlertSeverity } from "@/components/admin/dashboard/NeedsAttentionItem";

export type {
  ControlCenterAlert,
  ControlCenterAlertIconKey,
} from "@/lib/admin/control-center-types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * HOUR_MS);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * DAY_MS);
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function formatOccurredAt(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

function sortAlerts(
  alerts: Array<ControlCenterAlert & { occurredAt: Date }>
): ControlCenterAlert[] {
  return [...alerts]
    .sort((a, b) => {
      const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      if (sev !== 0) return sev;
      return b.occurredAt.getTime() - a.occurredAt.getTime();
    })
    .map(({ occurredAt: _occurredAt, ...alert }) => alert);
}

/**
 * Operational alerts for `/admin` (Needs Attention panel).
 *
 * Admin-gated at the page layer. Aggregate counts only in copy — no
 * per-client identifiers in titles or descriptions.
 */
export async function getControlCenterAlerts(): Promise<ControlCenterAlert[]> {
  const seventyTwoHoursAgo = hoursAgo(72);
  const sevenDaysAgo = daysAgo(7);

  const [
    stalledAssessmentCount,
    oldestStalledAssessment,
    staleReviewCount,
    oldestStaleReview,
    failedWebhookRows,
    unassignedLeadCount,
    oldestUnassignedLead,
    stalledIntakeCount,
    oldestStalledIntake,
    incompleteOnboardingCount,
    newestIncompleteAdvisor,
    subscriptionsAtRisk,
    latestAtRiskSubscription,
  ] = await Promise.all([
    prisma.assessment.count({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: seventyTwoHoursAgo },
      },
    }),
    prisma.assessment.findFirst({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: seventyTwoHoursAgo },
      },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    }),
    prisma.intakeApproval.count({
      where: {
        status: { in: ["PENDING", "IN_REVIEW"] },
        updatedAt: { lt: seventyTwoHoursAgo },
      },
    }),
    prisma.intakeApproval.findFirst({
      where: {
        status: { in: ["PENDING", "IN_REVIEW"] },
        updatedAt: { lt: seventyTwoHoursAgo },
      },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    }),
    prisma.stripeWebhookEvent
      .findMany({
        where: {
          status: "FAILED",
          receivedAt: { gte: sevenDaysAgo },
        },
        orderBy: { receivedAt: "desc" },
        take: 10,
        select: { id: true, receivedAt: true, eventType: true },
      })
      .catch(() => [] as Array<{ id: string; receivedAt: Date; eventType: string }>),
    prisma.governanceReviewLead.count({
      where: { assignedAdvisorId: null },
    }),
    prisma.governanceReviewLead.findFirst({
      where: { assignedAdvisorId: null },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.intakeInterview.count({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: sevenDaysAgo },
      },
    }),
    prisma.intakeInterview.findFirst({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: sevenDaysAgo },
      },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    }),
    prisma.user.count({
      where: {
        role: "ADVISOR",
        deletedAt: null,
        advisorPortalAccessEnabled: true,
        OR: [
          { subscription: null },
          {
            subscription: {
              status: { notIn: ["ACTIVE", "GRACE_PERIOD"] },
            },
          },
          {
            advisorProfile: {
              OR: [{ firmName: null }, { firmName: "" }],
            },
          },
        ],
      },
    }),
    prisma.user.findFirst({
      where: {
        role: "ADVISOR",
        deletedAt: null,
        advisorPortalAccessEnabled: true,
        OR: [
          { subscription: null },
          {
            subscription: {
              status: { notIn: ["ACTIVE", "GRACE_PERIOD"] },
            },
          },
          {
            advisorProfile: {
              OR: [{ firmName: null }, { firmName: "" }],
            },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
    prisma.subscription.count({
      where: { status: { in: ["PAST_DUE", "UNPAID", "CANCELLED"] } },
    }),
    prisma.subscription.findFirst({
      where: { status: { in: ["PAST_DUE", "UNPAID", "CANCELLED"] } },
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  const alerts: Array<ControlCenterAlert & { occurredAt: Date }> = [];
  const failedIntegrationCount = failedWebhookRows.length;
  const latestFailedWebhook = failedWebhookRows[0];

  if (stalledAssessmentCount > 0) {
    const occurredAt = oldestStalledAssessment?.updatedAt ?? seventyTwoHoursAgo;
    alerts.push({
      id: "stalled-assessments",
      title: `${stalledAssessmentCount} ${pluralize(stalledAssessmentCount, "Assessment")} Stalled`,
      description:
        "Assessments in progress with no activity for over 72 hours — clients may be blocked.",
      severity: stalledAssessmentCount >= 5 ? "high" : "medium",
      iconKey: "clock",
      href: "/admin/assessment",
      occurredAt,
      timestamp: formatOccurredAt(occurredAt),
    });
  }

  if (staleReviewCount > 0) {
    const occurredAt = oldestStaleReview?.updatedAt ?? seventyTwoHoursAgo;
    alerts.push({
      id: "stale-intake-reviews",
      title: `${staleReviewCount} ${pluralize(staleReviewCount, "Review")} Overdue`,
      description:
        "Intake approvals pending advisor action for more than 72 hours.",
      severity: staleReviewCount >= 5 ? "high" : "medium",
      iconKey: "clipboardList",
      href: "/admin/intake",
      occurredAt,
      timestamp: formatOccurredAt(occurredAt),
    });
  }

  if (failedIntegrationCount > 0) {
    const occurredAt = latestFailedWebhook?.receivedAt ?? sevenDaysAgo;
    alerts.push({
      id: "failed-integrations",
      title: `${failedIntegrationCount} Failed ${pluralize(failedIntegrationCount, "Integration", "Integrations")}`,
      description: latestFailedWebhook
        ? `Stripe webhook failures in the last 7 days (latest: ${latestFailedWebhook.eventType}).`
        : "External integration failures recorded in the last 7 days.",
      severity: failedIntegrationCount >= 3 ? "critical" : "high",
      iconKey: "puzzle",
      href: "/admin/operations",
      occurredAt,
      timestamp: formatOccurredAt(occurredAt),
    });
  }

  if (unassignedLeadCount > 0) {
    const occurredAt = oldestUnassignedLead?.createdAt ?? new Date();
    alerts.push({
      id: "unassigned-leads",
      title: `${unassignedLeadCount} Unassigned ${pluralize(unassignedLeadCount, "Request", "Requests")}`,
      description:
        "Governance review leads awaiting advisor assignment.",
      severity: unassignedLeadCount >= 10 ? "high" : "medium",
      iconKey: "clipboardList",
      href: "/admin/leads",
      occurredAt,
      timestamp: formatOccurredAt(occurredAt),
    });
  }

  if (stalledIntakeCount > 0) {
    const occurredAt = oldestStalledIntake?.updatedAt ?? sevenDaysAgo;
    alerts.push({
      id: "stalled-intakes",
      title: `${stalledIntakeCount} Stalled ${pluralize(stalledIntakeCount, "Intake")}`,
      description:
        "Client intake interviews in progress with no updates for over 7 days.",
      severity: stalledIntakeCount >= 5 ? "medium" : "low",
      iconKey: "clock",
      href: "/admin/intake",
      occurredAt,
      timestamp: formatOccurredAt(occurredAt),
    });
  }

  if (incompleteOnboardingCount > 0) {
    const occurredAt = newestIncompleteAdvisor?.updatedAt ?? new Date();
    alerts.push({
      id: "incomplete-advisor-onboarding",
      title: `${incompleteOnboardingCount} ${pluralize(incompleteOnboardingCount, "Advisor")} Onboarding Incomplete`,
      description:
        "Portal-enabled advisors missing an active subscription or firm profile details.",
      severity: "low",
      iconKey: "userPlus",
      href: "/admin/advisors",
      occurredAt,
      timestamp: formatOccurredAt(occurredAt),
    });
  }

  if (subscriptionsAtRisk > 0) {
    const occurredAt = latestAtRiskSubscription?.updatedAt ?? new Date();
    alerts.push({
      id: "subscriptions-at-risk",
      title: `${subscriptionsAtRisk} ${pluralize(subscriptionsAtRisk, "Subscription")} At Risk`,
      description:
        "Advisor subscriptions in past due, unpaid, or cancelled status.",
      severity: subscriptionsAtRisk >= 5 ? "medium" : "low",
      iconKey: "alertTriangle",
      href: "/admin/advisors?filter=all",
      occurredAt,
      timestamp: formatOccurredAt(occurredAt),
    });
  }

  return sortAlerts(alerts);
}
