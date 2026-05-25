import { prisma } from "@/lib/db";
import {
  toReportTemplateUi,
  type ReportTemplateUi,
} from "@/lib/reports/report-template-choice";

/**
 * §4.5 commit 3 (BRD §4.5): per-client report-list query helpers used by
 * the advisor + admin "view reports" pages. Auth is the caller's
 * responsibility — these helpers are read-only queries with no role
 * gating.
 */

export interface ReportListRow {
  id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  templateChoice: ReportTemplateUi;
  publishedAt: Date | null;
  publishedById: string | null;
  hasExecutiveSummary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Resolve the latest Assessment for a client (by `userId`) plus all
 * Reports rows for that assessment. Newest first by version desc.
 * Returns `null` when the client has no assessment.
 */
export async function getReportListForClient(clientUserId: string): Promise<{
  assessmentId: string;
  reports: ReportListRow[];
} | null> {
  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId: clientUserId },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (!latestAssessment) return null;

  const reports = await prisma.report.findMany({
    where: { assessmentId: latestAssessment.id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      templateChoice: true,
      publishedAt: true,
      publishedById: true,
      executiveSummary: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    assessmentId: latestAssessment.id,
    reports: reports.map((r) => ({
      id: r.id,
      version: r.version,
      status: r.status,
      templateChoice: toReportTemplateUi(r.templateChoice),
      publishedAt: r.publishedAt,
      publishedById: r.publishedById,
      hasExecutiveSummary: !!r.executiveSummary && r.executiveSummary.length > 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  };
}

/**
 * Resolve the editable DRAFT for a client's latest assessment, plus the
 * AssessmentRecommendation rows the advisor can annotate in the form.
 * Returns `null` when the client has no assessment, or no DRAFT exists
 * yet (caller should call `getOrCreateDraft` from report-actions to
 * create one before rendering the form).
 */
export async function getDraftWithRecommendations(
  clientUserId: string
): Promise<{
  assessmentId: string;
  draft: {
    id: string;
    version: number;
    templateChoice: ReportTemplateUi;
    executiveSummary: string | null;
    advisorNotes: Record<string, string>;
  };
  recommendations: Array<{
    serviceRecommendationId: string;
    name: string;
    category: string;
    description: string;
    priority: number;
    /** Pre-filled from `Report.advisorNotes` (frozen on the DRAFT) when
     *  set; else falls back to the live `AssessmentRecommendation.
     *  advisorNotes` so first-time editing inherits any commit-1 notes. */
    notes: string;
  }>;
} | null> {
  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId: clientUserId },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (!latestAssessment) return null;

  const draft = await prisma.report.findFirst({
    where: { assessmentId: latestAssessment.id, status: "DRAFT" },
    select: {
      id: true,
      version: true,
      templateChoice: true,
      executiveSummary: true,
      advisorNotes: true,
    },
  });
  if (!draft) return null;

  const recs = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId: latestAssessment.id },
    orderBy: { priority: "asc" },
    select: {
      serviceRecommendationId: true,
      priority: true,
      advisorNotes: true,
      serviceRecommendation: {
        select: { name: true, category: true, description: true },
      },
    },
  });

  const draftNotes = (draft.advisorNotes ?? {}) as Record<string, string>;

  return {
    assessmentId: latestAssessment.id,
    draft: {
      id: draft.id,
      version: draft.version,
      templateChoice: toReportTemplateUi(draft.templateChoice),
      executiveSummary: draft.executiveSummary,
      advisorNotes: draftNotes,
    },
    recommendations: recs.map((r) => ({
      serviceRecommendationId: r.serviceRecommendationId,
      name: r.serviceRecommendation.name,
      category: r.serviceRecommendation.category,
      description: r.serviceRecommendation.description,
      priority: r.priority,
      notes:
        draftNotes[r.serviceRecommendationId] ??
        r.advisorNotes ??
        "",
    })),
  };
}
