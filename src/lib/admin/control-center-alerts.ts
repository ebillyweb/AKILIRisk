import "server-only";

import { formatDistanceToNow } from "date-fns";
import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ControlCenterAlert } from "@/lib/admin/control-center-types";
import type { AlertSeverity } from "@/components/admin/dashboard/NeedsAttentionItem";
import {
  PRODUCTION_CLIENT_ASSESSMENT_WHERE,
  PRODUCTION_CLIENT_INTAKE_APPROVAL_WHERE,
  PRODUCTION_CLIENT_INTAKE_INTERVIEW_WHERE,
  productionUserWhere,
} from "@/lib/admin/metrics-user-filters";

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

/** Subscription statuses that count as covered for onboarding purposes. */
const COVERED_SUB_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "ACTIVE",
  "GRACE_PERIOD",
]);

/**
 * Shape fetched per portal-enabled advisor to evaluate onboarding completeness.
 * Mirrors the relations `resolveBillingContext` walks (enterprise membership
 * first, then solo subscription).
 */
type OnboardingAdvisor = {
  updatedAt: Date;
  advisorProfile: { firmName: string | null } | null;
  subscription: { status: SubscriptionStatus } | null;
  enterpriseMembership: {
    status: "INVITED" | "ACTIVE" | "SUSPENDED";
    enterprise: {
      status: "ACTIVE" | "PROVISIONING" | "SUSPENDED";
      subscription: { status: SubscriptionStatus } | null;
    };
  } | null;
};

/**
 * Whether a portal-enabled advisor has completed onboarding.
 *
 * Enterprise-aware, mirroring `resolveBillingContext`: an ACTIVE member of a
 * fully-provisioned firm is covered by the firm's subscription (and inherits
 * firm identity, so no personal `firmName` is required). Only solo advisors
 * are held to the personal-subscription + firm-profile checks.
 */
function isAdvisorOnboardingComplete(advisor: OnboardingAdvisor): boolean {
  const membership = advisor.enterpriseMembership;
  if (membership && membership.status === "ACTIVE") {
    const enterprise = membership.enterprise;
    // A firm that is not fully provisioned/active is not yet covering members.
    if (enterprise.status !== "ACTIVE") {
      return false;
    }
    const firmSub = enterprise.subscription;
    return firmSub !== null && COVERED_SUB_STATUSES.has(firmSub.status);
  }

  // Solo advisor: needs a covered personal subscription and firm profile detail.
  const soloSub = advisor.subscription;
  const hasCoveredSub =
    soloSub !== null && COVERED_SUB_STATUSES.has(soloSub.status);
  const firmName = advisor.advisorProfile?.firmName;
  const hasFirmDetails = typeof firmName === "string" && firmName.trim() !== "";
  return hasCoveredSub && hasFirmDetails;
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
    portalAdvisors,
    subscriptionsAtRisk,
    latestAtRiskSubscription,
  ] = await Promise.all([
    prisma.assessment.count({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: seventyTwoHoursAgo },
        ...PRODUCTION_CLIENT_ASSESSMENT_WHERE,
      },
    }),
    prisma.assessment.findFirst({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: seventyTwoHoursAgo },
        ...PRODUCTION_CLIENT_ASSESSMENT_WHERE,
      },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    }),
    prisma.intakeApproval.count({
      where: {
        status: { in: ["PENDING", "IN_REVIEW"] },
        updatedAt: { lt: seventyTwoHoursAgo },
        ...PRODUCTION_CLIENT_INTAKE_APPROVAL_WHERE,
      },
    }),
    prisma.intakeApproval.findFirst({
      where: {
        status: { in: ["PENDING", "IN_REVIEW"] },
        updatedAt: { lt: seventyTwoHoursAgo },
        ...PRODUCTION_CLIENT_INTAKE_APPROVAL_WHERE,
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
        ...PRODUCTION_CLIENT_INTAKE_INTERVIEW_WHERE,
      },
    }),
    prisma.intakeInterview.findFirst({
      where: {
        status: "IN_PROGRESS",
        updatedAt: { lt: sevenDaysAgo },
        ...PRODUCTION_CLIENT_INTAKE_INTERVIEW_WHERE,
      },
      orderBy: { updatedAt: "asc" },
      select: { updatedAt: true },
    }),
    prisma.user.findMany({
      where: productionUserWhere({
        role: "ADVISOR",
        deletedAt: null,
        advisorPortalAccessEnabled: true,
      }),
      select: {
        updatedAt: true,
        advisorProfile: { select: { firmName: true } },
        subscription: { select: { status: true } },
        enterpriseMembership: {
          select: {
            status: true,
            enterprise: {
              select: {
                status: true,
                subscription: { select: { status: true } },
              },
            },
          },
        },
      },
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

  const incompleteAdvisors = portalAdvisors.filter(
    (advisor) => !isAdvisorOnboardingComplete(advisor)
  );
  const incompleteOnboardingCount = incompleteAdvisors.length;
  const newestIncompleteAdvisor = incompleteAdvisors.reduce<
    { updatedAt: Date } | null
  >((newest, advisor) => {
    if (!newest || advisor.updatedAt > newest.updatedAt) {
      return advisor;
    }
    return newest;
  }, null);

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
