import "server-only";

import { prisma } from "@/lib/db";
import { resolveClientDisplayName } from "@/lib/signals/emit";
import { toReportTemplateUi } from "@/lib/reports/report-template-choice";
import type {
  ClientReportGroup,
  PortfolioReportItem,
  PortfolioReports,
  PortfolioReportsFilters,
} from "@/lib/reports/portfolio-types";

export async function getPortfolioReports(
  advisorProfileId: string,
  filters: PortfolioReportsFilters = {}
): Promise<PortfolioReports> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisorProfileId, status: "ACTIVE" },
    select: { clientId: true },
  });

  const clientIds = assignments.map((a) => a.clientId);
  if (clientIds.length === 0) {
    return {
      summary: {
        assignedClients: 0,
        clientsWithReports: 0,
        totalReports: 0,
        draftCount: 0,
        publishedCount: 0,
        needsPublishCount: 0,
      },
      groups: [],
    };
  }

  const assessments = await prisma.assessment.findMany({
    where: {
      userId: { in: clientIds },
      reports: { some: {} },
    },
    include: {
      reports: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          status: true,
          templateChoice: true,
          publishedAt: true,
          updatedAt: true,
          executiveSummary: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
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

  const groups: ClientReportGroup[] = [];
  let totalReports = 0;
  let draftCount = 0;
  let publishedCount = 0;
  let needsPublishCount = 0;

  for (const [clientId, assessment] of latestByClient) {
    const hasPublished = assessment.reports.some((r) => r.status === "PUBLISHED");
    const hasDraft = assessment.reports.some((r) => r.status === "DRAFT");
    const needsPublish = hasDraft && !hasPublished;

    if (filters.needsPublishOnly && !needsPublish) continue;

    let reportRows = assessment.reports;
    if (filters.status && filters.status !== "ALL") {
      reportRows = reportRows.filter((r) => r.status === filters.status);
    }
    if (reportRows.length === 0) continue;

    const items: PortfolioReportItem[] = reportRows.map((r) => {
      if (r.status === "DRAFT") draftCount += 1;
      if (r.status === "PUBLISHED") publishedCount += 1;
      totalReports += 1;

      return {
        reportId: r.id,
        version: r.version,
        status: r.status,
        templateChoice: toReportTemplateUi(r.templateChoice),
        publishedAt: r.publishedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
        hasExecutiveSummary: !!r.executiveSummary && r.executiveSummary.length > 0,
        pdfHref: `/api/reports/by-id/${r.id}/pdf`,
        editHref: r.status === "DRAFT" ? `/advisor/pipeline/${clientId}/report/edit` : null,
      };
    });

    if (needsPublish) needsPublishCount += 1;

    groups.push({
      clientId,
      clientName: clientNames.get(clientId) ?? "Client",
      assessmentId: assessment.id,
      assessmentStatus: assessment.status,
      completedAt: assessment.completedAt?.toISOString() ?? null,
      hasPublished,
      hasDraft,
      listHref: `/advisor/pipeline/${clientId}/report`,
      editHref: `/advisor/pipeline/${clientId}/report/edit`,
      reports: items,
    });
  }

  groups.sort((a, b) => {
    const aNeeds = a.hasDraft && !a.hasPublished ? 1 : 0;
    const bNeeds = b.hasDraft && !b.hasPublished ? 1 : 0;
    if (bNeeds !== aNeeds) return bNeeds - aNeeds;
    const aUpdated = a.reports[0]?.updatedAt ?? "";
    const bUpdated = b.reports[0]?.updatedAt ?? "";
    if (bUpdated !== aUpdated) return bUpdated.localeCompare(aUpdated);
    return a.clientName.localeCompare(b.clientName);
  });

  return {
    summary: {
      assignedClients: clientIds.length,
      clientsWithReports: groups.length,
      totalReports,
      draftCount,
      publishedCount,
      needsPublishCount,
    },
    groups,
  };
}
