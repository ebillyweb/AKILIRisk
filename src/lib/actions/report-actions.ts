"use server";

/**
 * §4.5 commit 3 (BRD §4.5) — Report lifecycle server actions.
 *
 * Workflow primitives:
 *   • getOrCreateDraft — idempotent open-edit-slot for an assessment.
 *   • saveDraftEdits — write executiveSummary / advisorNotes / template
 *     to the active DRAFT (no state transition).
 *   • publishReport — DRAFT → PUBLISHED transition. Snapshots scoring +
 *     branding + frozen editorial. Supersedes prior PUBLISHED. Opens a
 *     fresh DRAFT at version+1.
 *   • republishReport — admin-only. Builds a fresh snapshot from current
 *     live data, inherits editorial from prior PUBLISHED, supersedes the
 *     old. Used when a scoring bug fix needs to refresh frozen numbers.
 *
 * Concurrency: the partial unique index `Report_assessmentId_draft_unique`
 * (migration 20260522120000_reporting_engine) guarantees at most one
 * DRAFT per assessment at the DB level. publishReport's transaction
 * relies on that — the loser of a concurrent publish race surfaces the
 * Prisma constraint-violation P2002, which the action translates to a
 * structured `{ ok: false, code: "concurrent_publish" }` result.
 *
 * Audit: every state-changing path writes one audit row (REPORT_PUBLISH,
 * REPORT_REPUBLISH). Editorial saves are NOT audited per-keystroke;
 * they're aggregated implicitly by the publish row's afterData.
 */

import { Prisma, type ReportStatus, type ReportTemplate } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import {
  buildReportSnapshot,
  buildBrandingSnapshot,
} from "@/lib/pdf/build-report-snapshot";

const EXECUTIVE_SUMMARY_MAX = 2000;
const ADVISOR_NOTE_MAX = 1000;
const REPUBLISH_REASON_MAX = 500;

export type ReportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

interface SessionInfo {
  userId: string;
  role: string;
  email: string | null;
}

async function requireSession(): Promise<SessionInfo> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("not_authenticated");
  }
  return {
    userId: session.user.id,
    role: session.user.role ?? "USER",
    email: session.user.email ?? null,
  };
}

/**
 * Authorize the caller against an assessment. Returns the role-bucket the
 * caller falls into so callers can branch on assigned-advisor vs admin.
 */
async function authorizeForAssessment(
  session: SessionInfo,
  assessmentId: string
): Promise<
  | { ok: true; bucket: "ADMIN" | "ADVISOR"; assessment: { id: string; userId: string } }
  | { ok: false; code: "not_found" | "forbidden" }
> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, userId: true },
  });
  if (!assessment) return { ok: false, code: "not_found" };

  if (isPlatformAdminRole(session.role)) {
    return { ok: true, bucket: "ADMIN", assessment };
  }
  if (session.role === "ADVISOR") {
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (advisor) {
      const assignment = await prisma.clientAdvisorAssignment.findFirst({
        where: {
          advisorId: advisor.id,
          clientId: assessment.userId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      if (assignment) {
        return { ok: true, bucket: "ADVISOR", assessment };
      }
    }
  }
  return { ok: false, code: "forbidden" };
}

/**
 * Return the existing DRAFT for an assessment, or create one at the next
 * available version. Idempotent and safe under concurrent invocation —
 * the partial unique index turns a concurrent insert into a Prisma
 * P2002, which we catch and re-read.
 */
export async function getOrCreateDraft(
  assessmentId: string
): Promise<ReportActionResult<{ reportId: string; version: number }>> {
  const session = await requireSession();
  const auth = await authorizeForAssessment(session, assessmentId);
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.code,
      message:
        auth.code === "not_found" ? "Assessment not found." : "Forbidden.",
    };
  }

  // Cheap path: existing DRAFT.
  const existing = await prisma.report.findFirst({
    where: { assessmentId, status: "DRAFT" },
    select: { id: true, version: true },
  });
  if (existing) {
    return { ok: true, data: { reportId: existing.id, version: existing.version } };
  }

  // No DRAFT yet — compute next version and insert. P2002 on the partial
  // unique means another caller raced us; re-read and return that one.
  const latest = await prisma.report.findFirst({
    where: { assessmentId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;
  try {
    const created = await prisma.report.create({
      data: {
        assessmentId,
        version: nextVersion,
        status: "DRAFT",
        templateChoice: "COBRANDED",
      },
      select: { id: true, version: true },
    });
    return { ok: true, data: { reportId: created.id, version: created.version } };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const winner = await prisma.report.findFirst({
        where: { assessmentId, status: "DRAFT" },
        select: { id: true, version: true },
      });
      if (winner) {
        return {
          ok: true,
          data: { reportId: winner.id, version: winner.version },
        };
      }
    }
    throw err;
  }
}

export interface SaveDraftEditsInput {
  reportId: string;
  executiveSummary?: string | null;
  advisorNotes?: Record<string, string>;
  templateChoice?: ReportTemplate;
}

/**
 * Persist editorial changes onto a DRAFT row. Validates max-length on
 * `executiveSummary` (2000) and per-recommendation note (1000).
 */
export async function saveDraftEdits(
  input: SaveDraftEditsInput
): Promise<ReportActionResult<{ reportId: string }>> {
  const session = await requireSession();

  const draft = await prisma.report.findUnique({
    where: { id: input.reportId },
    select: { id: true, status: true, assessmentId: true },
  });
  if (!draft) {
    return { ok: false, code: "not_found", message: "Report not found." };
  }
  if (draft.status !== "DRAFT") {
    return {
      ok: false,
      code: "not_draft",
      message: "Only DRAFT reports can be edited.",
    };
  }

  const auth = await authorizeForAssessment(session, draft.assessmentId);
  if (!auth.ok) {
    return {
      ok: false,
      code: auth.code,
      message: "Forbidden.",
    };
  }

  if (
    input.executiveSummary != null &&
    input.executiveSummary.length > EXECUTIVE_SUMMARY_MAX
  ) {
    return {
      ok: false,
      code: "executive_summary_too_long",
      message: `Executive summary exceeds ${EXECUTIVE_SUMMARY_MAX} characters.`,
    };
  }
  if (input.advisorNotes) {
    for (const [recId, note] of Object.entries(input.advisorNotes)) {
      if (note.length > ADVISOR_NOTE_MAX) {
        return {
          ok: false,
          code: "advisor_note_too_long",
          message: `Note for ${recId} exceeds ${ADVISOR_NOTE_MAX} characters.`,
        };
      }
    }
  }

  await prisma.report.update({
    where: { id: input.reportId },
    data: {
      executiveSummary: input.executiveSummary,
      advisorNotes: (input.advisorNotes ??
        undefined) as Prisma.InputJsonValue | undefined,
      templateChoice: input.templateChoice,
    },
  });

  return { ok: true, data: { reportId: input.reportId } };
}

/**
 * DRAFT → PUBLISHED. Snapshots scoring + branding into the row,
 * supersedes any prior PUBLISHED for the same assessment, opens a fresh
 * DRAFT at version+1.
 */
export async function publishReport(
  reportId: string
): Promise<ReportActionResult<{ publishedReportId: string; version: number }>> {
  const session = await requireSession();

  const draft = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      assessmentId: true,
      version: true,
      executiveSummary: true,
      advisorNotes: true,
      templateChoice: true,
    },
  });
  if (!draft) {
    return { ok: false, code: "not_found", message: "Report not found." };
  }
  if (draft.status !== "DRAFT") {
    return {
      ok: false,
      code: "not_draft",
      message: "Only DRAFT reports can be published.",
    };
  }

  const auth = await authorizeForAssessment(session, draft.assessmentId);
  if (!auth.ok) {
    return { ok: false, code: auth.code, message: "Forbidden." };
  }

  // Build the snapshots OUTSIDE the transaction. They're read-only and
  // can be expensive; doing them inside the txn would extend the lock
  // window and increase contention.
  const snapshot = await buildReportSnapshot(draft.assessmentId);
  const branding = await buildBrandingSnapshot(draft.assessmentId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check status under the txn; another caller may have already
      // published this draft.
      const reread = await tx.report.findUnique({
        where: { id: reportId },
        select: { status: true, version: true, assessmentId: true },
      });
      if (!reread || reread.status !== "DRAFT") {
        throw new Error("draft_disappeared");
      }

      // Supersede any prior PUBLISHED for the same assessment.
      const supersedeResult = await tx.report.updateMany({
        where: {
          assessmentId: reread.assessmentId,
          status: "PUBLISHED",
        },
        data: { status: "SUPERSEDED" satisfies ReportStatus },
      });
      const supersededReportId =
        supersedeResult.count > 0
          ? (
              await tx.report.findFirst({
                where: {
                  assessmentId: reread.assessmentId,
                  status: "SUPERSEDED",
                },
                orderBy: { publishedAt: "desc" },
                select: { id: true },
              })
            )?.id ?? null
          : null;

      // DRAFT → PUBLISHED.
      const published = await tx.report.update({
        where: { id: reportId },
        data: {
          status: "PUBLISHED" satisfies ReportStatus,
          snapshotData: snapshot as unknown as Prisma.InputJsonValue,
          brandingSnapshot: (branding ??
            Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          publishedAt: new Date(),
          publishedById: session.userId,
        },
        select: { id: true, version: true },
      });

      // Open the next DRAFT. Inherit editorial from the just-published
      // row so the advisor can continue iterating without retyping.
      await tx.report.create({
        data: {
          assessmentId: reread.assessmentId,
          version: published.version + 1,
          status: "DRAFT" satisfies ReportStatus,
          templateChoice: draft.templateChoice,
          executiveSummary: draft.executiveSummary,
          advisorNotes: (draft.advisorNotes ??
            Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        },
      });

      return { publishedId: published.id, version: published.version, supersededReportId };
    });

    void writeAudit({
      actor: { userId: session.userId, role: session.role, email: session.email },
      action: AUDIT_ACTIONS.REPORT_PUBLISH,
      entityType: "Report",
      entityId: result.publishedId,
      beforeData: {
        version: draft.version,
        templateChoice: draft.templateChoice,
        hasExecutiveSummary: !!draft.executiveSummary,
      },
      afterData: {
        version: result.version,
        status: "PUBLISHED",
      },
      metadata: {
        assessmentId: draft.assessmentId,
        supersededReportId: result.supersededReportId,
        actorBucket: auth.bucket,
      },
    });

    return {
      ok: true,
      data: { publishedReportId: result.publishedId, version: result.version },
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // The fresh DRAFT insert lost a race against another concurrent
      // publish. Surface a structured error; the caller can refresh.
      return {
        ok: false,
        code: "concurrent_publish",
        message:
          "Another publish for this assessment landed first. Refresh and try again.",
      };
    }
    if (err instanceof Error && err.message === "draft_disappeared") {
      return {
        ok: false,
        code: "concurrent_publish",
        message: "This draft was already published.",
      };
    }
    throw err;
  }
}

export interface RepublishReportInput {
  /** Assessment id whose latest PUBLISHED row should be superseded. */
  assessmentId: string;
  /** Free-form admin justification, max 500 chars. Captured in audit. */
  reason: string;
}

/**
 * Admin-only republish. Builds a fresh snapshot from current live data,
 * inherits editorial fields from the prior PUBLISHED row, supersedes
 * the old. Does NOT mutate prior PUBLISHED/SUPERSEDED rows except for
 * the status flip. Original numbers stay frozen on the SUPERSEDED row.
 */
export async function republishReport(
  input: RepublishReportInput
): Promise<ReportActionResult<{ publishedReportId: string; version: number }>> {
  const session = await requireSession();
  if (!isPlatformAdminRole(session.role)) {
    return {
      ok: false,
      code: "forbidden",
      message: "Republish is admin-only.",
    };
  }

  const reason = input.reason?.trim() ?? "";
  if (reason.length === 0) {
    return {
      ok: false,
      code: "reason_required",
      message: "A reason is required for republish.",
    };
  }
  if (reason.length > REPUBLISH_REASON_MAX) {
    return {
      ok: false,
      code: "reason_too_long",
      message: `Reason exceeds ${REPUBLISH_REASON_MAX} characters.`,
    };
  }

  const previous = await prisma.report.findFirst({
    where: { assessmentId: input.assessmentId, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      version: true,
      executiveSummary: true,
      advisorNotes: true,
      templateChoice: true,
      snapshotData: true,
    },
  });
  if (!previous) {
    return {
      ok: false,
      code: "no_prior_publish",
      message:
        "No PUBLISHED report exists for this assessment yet — publish before republishing.",
    };
  }

  // Build snapshots from CURRENT live data outside the transaction.
  const snapshot = await buildReportSnapshot(input.assessmentId);
  const branding = await buildBrandingSnapshot(input.assessmentId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Latest version across all statuses (including the open DRAFT).
      const latest = await tx.report.findFirst({
        where: { assessmentId: input.assessmentId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (latest?.version ?? 0) + 1;

      // Supersede the old PUBLISHED.
      await tx.report.update({
        where: { id: previous.id },
        data: { status: "SUPERSEDED" satisfies ReportStatus },
      });

      // Insert the new PUBLISHED row inheriting editorial from previous.
      const newPublished = await tx.report.create({
        data: {
          assessmentId: input.assessmentId,
          version: nextVersion,
          status: "PUBLISHED" satisfies ReportStatus,
          templateChoice: previous.templateChoice,
          executiveSummary: previous.executiveSummary,
          advisorNotes: (previous.advisorNotes ??
            Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          snapshotData: snapshot as unknown as Prisma.InputJsonValue,
          brandingSnapshot: (branding ??
            Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          publishedAt: new Date(),
          publishedById: session.userId,
        },
        select: { id: true, version: true },
      });

      return { newPublishedId: newPublished.id, version: newPublished.version };
    });

    void writeAudit({
      actor: { userId: session.userId, role: session.role, email: session.email },
      action: AUDIT_ACTIONS.REPORT_REPUBLISH,
      entityType: "Report",
      entityId: result.newPublishedId,
      metadata: {
        assessmentId: input.assessmentId,
        supersededReportId: previous.id,
        previousVersion: previous.version,
        newVersion: result.version,
        reason,
      },
    });

    return {
      ok: true,
      data: {
        publishedReportId: result.newPublishedId,
        version: result.version,
      },
    };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: false,
        code: "concurrent_publish",
        message:
          "Another publish landed during republish. Refresh and try again.",
      };
    }
    throw err;
  }
}
