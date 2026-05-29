import "server-only";

import type { DeliverablePhase, RecommendationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveClientDisplayName } from "@/lib/signals/emit";
import { formatTriggerSummary } from "@/lib/recommendations/format-trigger";
import type {
  ClientRecommendationGroup,
  PortfolioRecommendationItem,
  PortfolioRecommendations,
  PortfolioRecommendationsFilters,
} from "@/lib/recommendations/types";

function isActionNeeded(
  status: RecommendationStatus,
  deliverablePhase: DeliverablePhase,
  hasDraftReport: boolean,
  hasPublishedReport: boolean
): boolean {
  if (status !== "PENDING") return false;
  if (deliverablePhase === "PREVIEW") return true;
  if (hasDraftReport && !hasPublishedReport) return true;
  return false;
}

export async function getPortfolioRecommendations(
  advisorProfileId: string,
  filters: PortfolioRecommendationsFilters = {}
): Promise<PortfolioRecommendations> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisorProfileId, status: "ACTIVE" },
    select: { clientId: true },
  });

  const clientIds = assignments.map((a) => a.clientId);
  if (clientIds.length === 0) {
    return {
      summary: {
        assignedClients: 0,
        clientsWithRecommendations: 0,
        totalRecommendations: 0,
        pendingCount: 0,
        actionNeededCount: 0,
      },
      groups: [],
    };
  }

  const assessments = await prisma.assessment.findMany({
    where: {
      userId: { in: clientIds },
      status: "COMPLETED",
      recommendations: { some: {} },
    },
    include: {
      recommendations: {
        orderBy: { priority: "asc" },
        include: {
          serviceRecommendation: {
            select: {
              id: true,
              name: true,
              category: true,
              description: true,
              tier: true,
            },
          },
        },
      },
      reports: { select: { status: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  const latestByClient = new Map<string, (typeof assessments)[number]>();
  for (const assessment of assessments) {
    if (!latestByClient.has(assessment.userId)) {
      latestByClient.set(assessment.userId, assessment);
    }
  }

  const clientNames = new Map<string, string>();
  await Promise.all(
    [...latestByClient.keys()].map(async (clientId) => {
      clientNames.set(clientId, await resolveClientDisplayName(clientId));
    })
  );

  const groups: ClientRecommendationGroup[] = [];

  for (const [clientId, assessment] of latestByClient) {
    const hasDraftReport = assessment.reports.some((r) => r.status === "DRAFT");
    const hasPublishedReport = assessment.reports.some((r) => r.status === "PUBLISHED");

    let items: PortfolioRecommendationItem[] = assessment.recommendations.map((rec) => ({
      id: rec.id,
      serviceRecommendationId: rec.serviceRecommendationId,
      serviceName: rec.serviceRecommendation.name,
      category: rec.serviceRecommendation.category,
      description: rec.serviceRecommendation.description,
      tier: rec.serviceRecommendation.tier,
      priority: rec.priority,
      status: rec.status,
      triggerSummary: formatTriggerSummary(rec.triggerReason),
      advisorNotes: rec.advisorNotes,
    }));

    if (filters.status === "pending") {
      items = items.filter((i) => i.status === "PENDING");
    }
    if (filters.category) {
      items = items.filter(
        (i) => i.category.toLowerCase() === filters.category!.toLowerCase()
      );
    }
    if (filters.actionNeededOnly) {
      items = items.filter((i) =>
        isActionNeeded(i.status, assessment.deliverablePhase, hasDraftReport, hasPublishedReport)
      );
    }

    if (items.length === 0) continue;

    groups.push({
      clientId,
      clientName: clientNames.get(clientId) ?? "Client",
      assessmentId: assessment.id,
      deliverablePhase: assessment.deliverablePhase,
      completedAt: assessment.completedAt?.toISOString() ?? null,
      hasDraftReport,
      hasPublishedReport,
      editReportHref: `/advisor/pipeline/${clientId}/report/edit`,
      intelligenceHref: `/advisor/intelligence/${clientId}`,
      recommendations: items,
    });
  }

  groups.sort((a, b) => {
    const aPending = a.recommendations.filter((r) => r.status === "PENDING").length;
    const bPending = b.recommendations.filter((r) => r.status === "PENDING").length;
    if (bPending !== aPending) return bPending - aPending;
    return a.clientName.localeCompare(b.clientName);
  });

  let totalRecommendations = 0;
  let pendingCount = 0;
  let actionNeededCount = 0;

  for (const group of groups) {
    totalRecommendations += group.recommendations.length;
    for (const rec of group.recommendations) {
      if (rec.status === "PENDING") pendingCount += 1;
      if (
        isActionNeeded(
          rec.status,
          group.deliverablePhase,
          group.hasDraftReport,
          group.hasPublishedReport
        )
      ) {
        actionNeededCount += 1;
      }
    }
  }

  return {
    summary: {
      assignedClients: clientIds.length,
      clientsWithRecommendations: groups.length,
      totalRecommendations,
      pendingCount,
      actionNeededCount,
    },
    groups,
  };
}
