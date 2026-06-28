import type { AdvisorNotification } from "@prisma/client";
import type { PipelineClient, PipelineMetrics } from "@/lib/pipeline/types";
import type { PortfolioIntelligence } from "@/lib/intelligence/types";
import { advisorNotificationHref } from "@/lib/advisor/notification-links";
import { STALE_SCORES_COPY } from "@/lib/advisor/assessment-lifecycle-copy";

export type AdvisorPriorityItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  kind: "review" | "documents" | "stalled" | "invitation" | "in_progress";
  count?: number;
};

export type AdvisorActivityItem = {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  href: string;
};

export type AdvisorIntelligenceHighlight = {
  id: string;
  title: string;
  description: string;
  href: string;
  severity?: "critical" | "moderate" | "low";
};

export function deriveAdvisorPriorities(
  clients: PipelineClient[],
  metrics: PipelineMetrics,
  pendingInvitationsCount: number
): AdvisorPriorityItem[] {
  const priorities: AdvisorPriorityItem[] = [];

  const reviewsNeeded = metrics.intakesAwaitingReview ?? 0;
  if (reviewsNeeded > 0) {
    const firstReview = clients.find((c) => c.awaitingIntakeReview);
    priorities.push({
      id: "reviews",
      kind: "review",
      title: "Intakes awaiting review",
      description: `${reviewsNeeded} client${reviewsNeeded === 1 ? "" : "s"} submitted intake pending your approval.`,
      href: firstReview?.intakeReviewInterviewId
        ? `/advisor/review/${firstReview.intakeReviewInterviewId}`
        : "/advisor/pipeline?awaitingReview=1",
      count: reviewsNeeded,
    });
  }

  if (metrics.documentsNeeded > 0) {
    priorities.push({
      id: "documents",
      kind: "documents",
      title: "Document requests outstanding",
      description: `${metrics.documentsNeeded} client${metrics.documentsNeeded === 1 ? "" : "s"} have unfulfilled required documents.`,
      href: "/advisor/pipeline?documentsNeeded=1",
      count: metrics.documentsNeeded,
    });
  }

  if (metrics.staleScores > 0) {
    priorities.push({
      id: "rescore",
      kind: "in_progress",
      title: STALE_SCORES_COPY.workspaceTitle,
      description: `${metrics.staleScores} client${metrics.staleScores === 1 ? "" : "s"} changed answers after completing the assessment. Scores may need a platform re-score.`,
      href: "/advisor/pipeline?staleScores=1",
      count: metrics.staleScores,
    });
  }

  if (metrics.stalled > 0) {
    priorities.push({
      id: "stalled",
      kind: "stalled",
      title: "Stalled clients",
      description: `${metrics.stalled} client${metrics.stalled === 1 ? "" : "s"} with no activity in 7+ days.`,
      href: "/advisor/pipeline?stalled=1",
      count: metrics.stalled,
    });
  }

  if (pendingInvitationsCount > 0) {
    priorities.push({
      id: "invitations",
      kind: "invitation",
      title: "Pending invitations",
      description: `${pendingInvitationsCount} invitation${pendingInvitationsCount === 1 ? "" : "s"} not yet accepted.`,
      href: "/advisor/invitations",
      count: pendingInvitationsCount,
    });
  }

  const inFlight =
    (metrics.byStage.INTAKE_IN_PROGRESS ?? 0) +
    (metrics.byStage.ASSESSMENT_IN_PROGRESS ?? 0);
  if (inFlight > 0 && priorities.length < 5) {
    const names = clients
      .filter(
        (c) =>
          c.stage === "INTAKE_IN_PROGRESS" || c.stage === "ASSESSMENT_IN_PROGRESS"
      )
      .slice(0, 2)
      .map((c) => c.name || c.email)
      .join(", ");
    priorities.push({
      id: "in-flight",
      kind: "in_progress",
      title: "Active intake & assessments",
      description: names
        ? `${inFlight} in progress — including ${names}${inFlight > 2 ? "…" : ""}.`
        : `${inFlight} client${inFlight === 1 ? "" : "s"} currently in intake or assessment.`,
      href: "/advisor/pipeline",
      count: inFlight,
    });
  }

  return priorities.slice(0, 6);
}

export function mapNotificationsToActivity(
  notifications: AdvisorNotification[]
): AdvisorActivityItem[] {
  return notifications.slice(0, 8).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    createdAt: n.createdAt,
    read: n.read,
    href: advisorNotificationHref(n),
  }));
}

export function deriveIntelligenceHighlights(
  data: PortfolioIntelligence | null,
  intelligenceEnabled: boolean
): AdvisorIntelligenceHighlight[] {
  if (!intelligenceEnabled || !data || data.totalFamilies === 0) {
    return [];
  }

  const highlights: AdvisorIntelligenceHighlight[] = [];

  if (data.criticalCount > 0) {
    highlights.push({
      id: "critical",
      title: "Critical portfolio risks",
      description: `${data.criticalCount} critical indicator${data.criticalCount === 1 ? "" : "s"} across ${data.familiesAtRisk} families at elevated risk.`,
      href: "/advisor/intelligence",
      severity: "critical",
    });
  }

  const topRisk = data.portfolioRisks[0];
  if (topRisk) {
    highlights.push({
      id: `risk-${topRisk.familyId}-${topRisk.categorySlug}`,
      title: topRisk.categoryName,
      description: `${topRisk.familyName} — score ${topRisk.score.toFixed(1)} (${topRisk.severity}).`,
      href: `/advisor/intelligence/${topRisk.familyId}`,
      severity: topRisk.severity,
    });
  }

  highlights.push({
    id: "portfolio",
    title: "Portfolio coverage",
    description: `${data.totalFamilies} families with completed assessments; ${data.portfolioRisks.length} active risk indicators tracked.`,
    href: "/advisor/intelligence",
  });

  return highlights.slice(0, 4);
}
