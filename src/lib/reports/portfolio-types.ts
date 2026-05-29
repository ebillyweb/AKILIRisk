import type { ReportStatus } from "@prisma/client";
import type { ReportTemplateUi } from "@/lib/reports/report-template-choice";

export type PortfolioReportItem = {
  reportId: string;
  version: number;
  status: ReportStatus;
  templateChoice: ReportTemplateUi;
  publishedAt: string | null;
  updatedAt: string;
  hasExecutiveSummary: boolean;
  pdfHref: string;
  editHref: string | null;
};

export type ClientReportGroup = {
  clientId: string;
  clientName: string;
  assessmentId: string;
  assessmentStatus: string;
  completedAt: string | null;
  hasPublished: boolean;
  hasDraft: boolean;
  listHref: string;
  editHref: string;
  reports: PortfolioReportItem[];
};

export type PortfolioReportsSummary = {
  assignedClients: number;
  clientsWithReports: number;
  totalReports: number;
  draftCount: number;
  publishedCount: number;
  needsPublishCount: number;
};

export type PortfolioReports = {
  summary: PortfolioReportsSummary;
  groups: ClientReportGroup[];
};

export type PortfolioReportsFilters = {
  status?: "ALL" | ReportStatus;
  needsPublishOnly?: boolean;
};
