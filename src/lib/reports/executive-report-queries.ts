import { prisma } from "@/lib/db";

/**
 * Phase 25: per-client executive report query helpers.
 *
 * Auth is the caller's responsibility — these helpers are read-only
 * queries with no role gating (same pattern as queries.ts).
 */

export interface ExecutiveReportListRow {
  id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "SUPERSEDED";
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  publishedAt: Date | null;
  publishedById: string | null;
  hasAdvisorNotes: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * All executive reports for a (client, advisor) pair, newest version first.
 */
export async function getExecutiveReportListForClient(
  clientUserId: string,
  advisorProfileId: string
): Promise<ExecutiveReportListRow[]> {
  const rows = await prisma.executiveReport.findMany({
    where: {
      clientId: clientUserId,
      advisorProfileId,
    },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      status: true,
      reportingPeriodStart: true,
      reportingPeriodEnd: true,
      publishedAt: true,
      publishedById: true,
      advisorNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    status: r.status,
    reportingPeriodStart: r.reportingPeriodStart,
    reportingPeriodEnd: r.reportingPeriodEnd,
    publishedAt: r.publishedAt,
    publishedById: r.publishedById,
    hasAdvisorNotes: !!r.advisorNotes && r.advisorNotes.length > 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Load the editable fields for the draft form. Returns null when the row
 * is not found.
 */
export async function getExecutiveDraftData(reportId: string): Promise<{
  id: string;
  version: number;
  status: string;
  advisorNotes: string | null;
  meetingAgenda: string | null;
  discussionPrompts: string[];
  reportingPeriodStart: Date;
  reportingPeriodEnd: Date;
  clientId: string;
  advisorProfileId: string;
} | null> {
  const row = await prisma.executiveReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      version: true,
      status: true,
      advisorNotes: true,
      meetingAgenda: true,
      discussionPrompts: true,
      reportingPeriodStart: true,
      reportingPeriodEnd: true,
      clientId: true,
      advisorProfileId: true,
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    version: row.version,
    status: row.status,
    advisorNotes: row.advisorNotes,
    meetingAgenda: row.meetingAgenda,
    discussionPrompts: Array.isArray(row.discussionPrompts)
      ? (row.discussionPrompts as string[])
      : [],
    reportingPeriodStart: row.reportingPeriodStart,
    reportingPeriodEnd: row.reportingPeriodEnd,
    clientId: row.clientId,
    advisorProfileId: row.advisorProfileId,
  };
}
