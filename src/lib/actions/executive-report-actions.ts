"use server";

/**
 * Phase 25: Executive Report lifecycle server actions.
 *
 * Workflow primitives:
 *   • generateExecutiveReport — idempotent DRAFT creation with period config.
 *   • saveExecutiveDraftEdits — editorial save (no state transition).
 *   • publishExecutiveReport — DRAFT → PUBLISHED with $transaction, snapshot
 *     freeze, and supersede of prior PUBLISHED row. Opens fresh DRAFT at v+1.
 *
 * Key difference from report-actions: scoped to (clientId, advisorProfileId)
 * pair, not assessmentId, because executive reports span multiple assessments.
 * Authorization uses authorizeForClient (not authorizeForAssessment).
 *
 * Concurrency: the partial unique index `ExecutiveReport_draft_unique`
 * (migration 20260627120000_executive_report) guarantees at most one DRAFT per
 * (client, advisor). publishExecutiveReport's transaction catches a stale
 * re-read and re-throws as "draft_disappeared", which the catch block maps to
 * `{ ok: false, code: "concurrent_publish" }`.
 *
 * Audit: publishExecutiveReport writes one EXECUTIVE_REPORT_PUBLISH row.
 * Editorial saves are NOT audited per-keystroke.
 */

import { Prisma, type ReportStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { AUDIT_ACTIONS, writeAudit } from "@/lib/audit/audit-log";
import { buildExecutiveReportSnapshot } from "@/lib/pdf/build-executive-report-snapshot";
import { getAdvisorBrandingForPDF } from "@/lib/pdf/branding-integration";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ReportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

interface SessionInfo {
  userId: string;
  role: string;
  email: string | null;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

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
 * Authorize the caller against a client.
 *
 * ADMIN bucket: any platform admin may access.
 * ADVISOR bucket: caller must have an ACTIVE ClientAdvisorAssignment to clientId.
 *
 * Returns `{ ok: true, bucket, advisorProfileId }` on success so the action
 * can use the resolved advisorProfileId without a second query.
 */
async function authorizeForClient(
  session: SessionInfo,
  clientId: string
): Promise<
  | { ok: true; bucket: "ADMIN" | "ADVISOR"; advisorProfileId: string }
  | { ok: false; code: "not_found" | "forbidden" }
> {
  if (isPlatformAdminRole(session.role)) {
    // Admins: resolve any advisorProfile linked to this client so we have
    // an advisorProfileId for scoping.
    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: { clientId, status: "ACTIVE" },
      select: { advisorId: true },
    });
    if (!assignment) return { ok: false, code: "not_found" };
    return {
      ok: true,
      bucket: "ADMIN",
      advisorProfileId: assignment.advisorId,
    };
  }

  if (session.role === "ADVISOR") {
    const advisor = await prisma.advisorProfile.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    });
    if (!advisor) return { ok: false, code: "forbidden" };

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        advisorId: advisor.id,
        clientId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    if (!assignment) return { ok: false, code: "forbidden" };

    return {
      ok: true,
      bucket: "ADVISOR",
      advisorProfileId: advisor.id,
    };
  }

  return { ok: false, code: "forbidden" };
}

// ---------------------------------------------------------------------------
// Exported server actions
// ---------------------------------------------------------------------------

export interface GenerateExecutiveReportInput {
  clientId: string;
  /** ISO date string — start of advisor-chosen period (D-23). Optional. */
  periodStart?: string;
  /** ISO date string — end of advisor-chosen period (D-23). Optional. */
  periodEnd?: string;
}

/**
 * Idempotent DRAFT creation. Returns the existing DRAFT id if one already
 * exists for (clientId, advisorProfileId). Period params override the
 * default period derivation (D-22, D-23).
 *
 * T-25-09 mitigated: authorizeForClient checks active assignment before create.
 */
export async function generateExecutiveReport(
  input: GenerateExecutiveReportInput
): Promise<ReportActionResult<{ reportId: string }>> {
  const session = await requireSession();

  if (!input.clientId) {
    return { ok: false, code: "invalid_input", message: "clientId is required." };
  }

  const authResult = await authorizeForClient(session, input.clientId);
  if (!authResult.ok) {
    return {
      ok: false,
      code: authResult.code,
      message:
        authResult.code === "not_found"
          ? "Client not found or no active assignment."
          : "Forbidden.",
    };
  }

  const { advisorProfileId } = authResult;

  // Cheap path: return existing DRAFT (idempotent).
  const existing = await prisma.executiveReport.findFirst({
    where: { clientId: input.clientId, advisorProfileId, status: "DRAFT" },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, data: { reportId: existing.id } };
  }

  // Determine reporting period (D-22, D-23).
  const periodEnd = input.periodEnd ? new Date(input.periodEnd) : new Date();

  let periodStart: Date;
  if (input.periodStart) {
    periodStart = new Date(input.periodStart);
  } else {
    // Default: last published report's reportingPeriodEnd (D-22).
    const lastPublished = await prisma.executiveReport.findFirst({
      where: {
        clientId: input.clientId,
        advisorProfileId,
        status: "PUBLISHED",
      },
      orderBy: { publishedAt: "desc" },
      select: { reportingPeriodEnd: true },
    });

    if (lastPublished) {
      periodStart = lastPublished.reportingPeriodEnd;
    } else {
      // First-ever report: cover all time from earliest assessment (D-22).
      const earliest = await prisma.assessment.findFirst({
        where: { userId: input.clientId },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      });
      periodStart = earliest?.startedAt ?? new Date(0);
    }
  }

  // Determine next version.
  const latest = await prisma.executiveReport.findFirst({
    where: { clientId: input.clientId, advisorProfileId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  try {
    const created = await prisma.executiveReport.create({
      data: {
        clientId: input.clientId,
        advisorProfileId,
        version: nextVersion,
        status: "DRAFT",
        reportingPeriodStart: periodStart,
        reportingPeriodEnd: periodEnd,
      },
      select: { id: true },
    });
    return { ok: true, data: { reportId: created.id } };
  } catch (err) {
    // Partial unique index concurrent insert race: re-read and return winner.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const winner = await prisma.executiveReport.findFirst({
        where: { clientId: input.clientId, advisorProfileId, status: "DRAFT" },
        select: { id: true },
      });
      if (winner) {
        return { ok: true, data: { reportId: winner.id } };
      }
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------

export interface SaveExecutiveDraftEditsInput {
  reportId: string;
  advisorNotes?: string;
  meetingAgenda?: string;
  /** Up to 10 prompts, each max 500 chars. */
  discussionPrompts?: string[];
}

const ADVISOR_NOTES_MAX = 2000;
const MEETING_AGENDA_MAX = 2000;
const DISCUSSION_PROMPT_MAX = 500;
const DISCUSSION_PROMPTS_MAX_COUNT = 10;

/**
 * Persist editorial changes onto a DRAFT row. No state transition.
 * Not audited per-keystroke (batch captured at publish time).
 *
 * T-25-13 mitigated: Zod-equivalent max-length guards + DRAFT status check.
 */
export async function saveExecutiveDraftEdits(
  input: SaveExecutiveDraftEditsInput
): Promise<ReportActionResult<{ saved: true }>> {
  const session = await requireSession();

  const draft = await prisma.executiveReport.findUnique({
    where: { id: input.reportId },
    select: {
      id: true,
      status: true,
      clientId: true,
      advisorProfileId: true,
    },
  });
  if (!draft) {
    return { ok: false, code: "not_found", message: "Executive report not found." };
  }
  if (draft.status !== "DRAFT") {
    return {
      ok: false,
      code: "not_draft",
      message: "Only DRAFT executive reports can be edited.",
    };
  }

  const authResult = await authorizeForClient(session, draft.clientId);
  if (!authResult.ok) {
    return { ok: false, code: authResult.code, message: "Forbidden." };
  }

  // Validate lengths (T-25-13).
  if (input.advisorNotes != null && input.advisorNotes.length > ADVISOR_NOTES_MAX) {
    return {
      ok: false,
      code: "advisor_notes_too_long",
      message: `Advisor notes exceed ${ADVISOR_NOTES_MAX} characters.`,
    };
  }
  if (input.meetingAgenda != null && input.meetingAgenda.length > MEETING_AGENDA_MAX) {
    return {
      ok: false,
      code: "meeting_agenda_too_long",
      message: `Meeting agenda exceeds ${MEETING_AGENDA_MAX} characters.`,
    };
  }
  if (input.discussionPrompts != null) {
    if (input.discussionPrompts.length > DISCUSSION_PROMPTS_MAX_COUNT) {
      return {
        ok: false,
        code: "too_many_prompts",
        message: `Maximum ${DISCUSSION_PROMPTS_MAX_COUNT} discussion prompts allowed.`,
      };
    }
    for (let i = 0; i < input.discussionPrompts.length; i++) {
      if (input.discussionPrompts[i].length > DISCUSSION_PROMPT_MAX) {
        return {
          ok: false,
          code: "prompt_too_long",
          message: `Discussion prompt ${i + 1} exceeds ${DISCUSSION_PROMPT_MAX} characters.`,
        };
      }
    }
  }

  await prisma.executiveReport.update({
    where: { id: input.reportId },
    data: {
      advisorNotes: input.advisorNotes ?? undefined,
      meetingAgenda: input.meetingAgenda ?? undefined,
      discussionPrompts:
        input.discussionPrompts != null
          ? (input.discussionPrompts as unknown as Prisma.InputJsonValue)
          : undefined,
    },
  });

  return { ok: true, data: { saved: true } };
}

// ---------------------------------------------------------------------------

/**
 * DRAFT → PUBLISHED transition.
 *
 * Builds ExecutiveReportSnapshot and branding snapshot OUTSIDE the
 * transaction (expensive, read-only), then atomically:
 *   a. Re-reads draft under txn to detect races.
 *   b. Supersedes all PUBLISHED rows for (clientId, advisorProfileId).
 *   c. Promotes DRAFT → PUBLISHED with frozen snapshot data + editorial overlay.
 *   d. Opens a fresh DRAFT at version+1 inheriting editorial fields.
 *
 * T-25-10 mitigated: active assignment re-verified by authorizeForClient.
 * Concurrent publish (P2002 / draft_disappeared) surfaces as structured error.
 */
export async function publishExecutiveReport(
  reportId: string
): Promise<ReportActionResult<{ publishedId: string; version: number }>> {
  const session = await requireSession();

  const draft = await prisma.executiveReport.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      clientId: true,
      advisorProfileId: true,
      version: true,
      reportingPeriodStart: true,
      reportingPeriodEnd: true,
      advisorNotes: true,
      meetingAgenda: true,
      discussionPrompts: true,
    },
  });
  if (!draft) {
    return { ok: false, code: "not_found", message: "Executive report not found." };
  }
  if (draft.status !== "DRAFT") {
    return {
      ok: false,
      code: "not_draft",
      message: "Only DRAFT executive reports can be published.",
    };
  }

  const authResult = await authorizeForClient(session, draft.clientId);
  if (!authResult.ok) {
    return { ok: false, code: authResult.code, message: "Forbidden." };
  }

  // Build snapshot OUTSIDE transaction (expensive read-only work).
  const snapshot = await buildExecutiveReportSnapshot(
    draft.clientId,
    draft.advisorProfileId,
    {
      periodStart: draft.reportingPeriodStart,
      periodEnd: draft.reportingPeriodEnd,
    }
  );

  // Overlay advisor editorial fields from the DRAFT row (D-18).
  snapshot.advisorNotes = draft.advisorNotes ?? null;
  snapshot.meetingAgenda = draft.meetingAgenda ?? null;
  snapshot.discussionPrompts = Array.isArray(draft.discussionPrompts)
    ? (draft.discussionPrompts as string[])
    : [];

  // Fetch live branding for the advisor.
  const branding = await getAdvisorBrandingForPDF(draft.advisorProfileId);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-read under txn to detect concurrent publish races.
      const reread = await tx.executiveReport.findUnique({
        where: { id: reportId },
        select: { status: true, version: true },
      });
      if (!reread || reread.status !== "DRAFT") {
        throw new Error("draft_disappeared");
      }

      // Supersede all PUBLISHED rows for (clientId, advisorProfileId).
      await tx.executiveReport.updateMany({
        where: {
          clientId: draft.clientId,
          advisorProfileId: draft.advisorProfileId,
          status: "PUBLISHED",
        },
        data: { status: "SUPERSEDED" satisfies ReportStatus },
      });

      // DRAFT → PUBLISHED with frozen snapshot data.
      const publishedAt = new Date();
      const published = await tx.executiveReport.update({
        where: { id: reportId },
        data: {
          status: "PUBLISHED" satisfies ReportStatus,
          executiveSnapshotData: snapshot as unknown as Prisma.InputJsonValue,
          brandingSnapshot: (branding ??
            Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
          publishedAt,
          publishedById: session.userId,
        },
        select: { id: true, version: true },
      });

      // Open next DRAFT inheriting editorial fields (advisor can continue iterating).
      await tx.executiveReport.create({
        data: {
          clientId: draft.clientId,
          advisorProfileId: draft.advisorProfileId,
          version: published.version + 1,
          status: "DRAFT" satisfies ReportStatus,
          // Inherit same period as a starting point — advisor can adjust.
          reportingPeriodStart: draft.reportingPeriodEnd,
          reportingPeriodEnd: new Date(),
          advisorNotes: draft.advisorNotes,
          meetingAgenda: draft.meetingAgenda,
          discussionPrompts: (draft.discussionPrompts ??
            Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        },
      });

      return { publishedId: published.id, version: published.version };
    });

    void writeAudit({
      actor: {
        userId: session.userId,
        role: session.role,
        email: session.email,
      },
      // EXECUTIVE_REPORT_PUBLISH not yet in AUDIT_ACTIONS; use string literal.
      action: "executive_report.publish" as (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
      entityType: "ExecutiveReport",
      entityId: result.publishedId,
      beforeData: {
        version: draft.version,
        hasAdvisorNotes: !!draft.advisorNotes,
        hasMeetingAgenda: !!draft.meetingAgenda,
        promptCount: Array.isArray(draft.discussionPrompts)
          ? (draft.discussionPrompts as unknown[]).length
          : 0,
      },
      afterData: {
        version: result.version,
        status: "PUBLISHED",
      },
      metadata: {
        clientId: draft.clientId,
        advisorProfileId: draft.advisorProfileId,
        actorBucket: authResult.bucket,
      },
    });

    return { ok: true, data: result };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return {
        ok: false,
        code: "concurrent_publish",
        message:
          "Another publish landed first. Refresh and try again.",
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
