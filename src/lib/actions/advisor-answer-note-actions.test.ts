import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  prismaSpies,
  writeAuditSpy,
  requireAdvisorRoleSpy,
  getAdvisorProfileOrThrowSpy,
} = vi.hoisted(() => ({
  prismaSpies: {
    intakeInterview: { findUnique: vi.fn() },
    intakeResponse: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    intakeResponseAdvisorNote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    assessmentResponse: { findUnique: vi.fn() },
    assessmentResponseAdvisorNote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    clientAdvisorAssignment: { findFirst: vi.fn() },
  },
  writeAuditSpy: vi.fn().mockResolvedValue(undefined),
  requireAdvisorRoleSpy: vi.fn().mockResolvedValue({
    userId: "advisor-user-1",
    email: "advisor@test.com",
    role: "ADVISOR",
  }),
  getAdvisorProfileOrThrowSpy: vi.fn().mockResolvedValue({
    id: "advisor-profile-1",
  }),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/audit-log")>(
    "@/lib/audit/audit-log"
  );
  return { ...actual, writeAudit: (...args: unknown[]) => writeAuditSpy(...args) };
});
vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: () => requireAdvisorRoleSpy(),
  getAdvisorProfileOrThrow: (userId: string) =>
    getAdvisorProfileOrThrowSpy(userId),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  saveIntakeResponseAdvisorNote,
  saveIntakeQuestionAdvisorNote,
  deleteIntakeResponseAdvisorNote,
  saveAssessmentResponseAdvisorNote,
  deleteAssessmentResponseAdvisorNote,
} from "./advisor-answer-note-actions";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdvisorRoleSpy.mockResolvedValue({
    userId: "advisor-user-1",
    email: "advisor@test.com",
    role: "ADVISOR",
  });
  getAdvisorProfileOrThrowSpy.mockResolvedValue({ id: "advisor-profile-1" });
});

function mockAssignedIntakeResponse(opts: {
  existing?: { id: string; body: string } | null;
  hasClientAnswer?: boolean;
}) {
  prismaSpies.intakeResponse.findUnique.mockResolvedValue({
    id: "ir-1",
    interviewId: "int-1",
    answeredAt: opts.hasClientAnswer === false ? null : new Date(),
    audioUrl: null,
    audioS3Key: null,
    hasTranscription: opts.hasClientAnswer !== false,
    transcription: opts.hasClientAnswer === false ? null : "answered",
    interview: { userId: "client-1" },
  });
  prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({ id: "a-1" });
  prismaSpies.intakeResponseAdvisorNote.findUnique.mockResolvedValue(
    opts.existing ?? null
  );
}

function mockAssignedIntakeQuestion() {
  prismaSpies.intakeInterview.findUnique.mockResolvedValue({
    id: "int-1",
    userId: "client-1",
  });
  prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({ id: "a-1" });
  prismaSpies.intakeResponse.upsert.mockResolvedValue({ id: "ir-new" });
}

function mockAssignedAssessmentResponse(opts: {
  existing?: { id: string; body: string } | null;
}) {
  prismaSpies.assessmentResponse.findUnique.mockResolvedValue({
    id: "ar-1",
    assessmentId: "as-1",
    assessment: { userId: "client-1" },
  });
  prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({ id: "a-1" });
  prismaSpies.assessmentResponseAdvisorNote.findUnique.mockResolvedValue(
    opts.existing ?? null
  );
}

describe("advisor answer notes (US-46c)", () => {
  // ── auth gate ─────────────────────────────────────────────────────────────
  it("refuses save when caller is not authenticated", async () => {
    requireAdvisorRoleSpy.mockRejectedValueOnce(new Error("Not authenticated"));
    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "x",
    });
    expect(result).toEqual({ success: false, error: "Not authenticated" });
    expect(prismaSpies.intakeResponseAdvisorNote.create).not.toHaveBeenCalled();
  });

  it("refuses save when caller is not an advisor", async () => {
    requireAdvisorRoleSpy.mockRejectedValueOnce(
      new Error("Unauthorized: Advisor access required")
    );
    const result = await saveAssessmentResponseAdvisorNote({
      assessmentResponseId: "ar-1",
      body: "x",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/Unauthorized/);
    }
  });

  // ── tenant isolation ──────────────────────────────────────────────────────
  it("refuses intake save when client is not assigned to the calling advisor", async () => {
    prismaSpies.intakeResponse.findUnique.mockResolvedValue({
      id: "ir-1",
      interviewId: "int-1",
      interview: { userId: "client-2" },
    });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "note",
    });

    expect(result).toEqual({ success: false, error: "Not found." });
    expect(prismaSpies.intakeResponseAdvisorNote.create).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("refuses assessment delete when client is not assigned to the calling advisor", async () => {
    prismaSpies.assessmentResponse.findUnique.mockResolvedValue({
      id: "ar-1",
      assessmentId: "as-1",
      assessment: { userId: "client-2" },
    });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    const result = await deleteAssessmentResponseAdvisorNote("ar-1");

    expect(result).toEqual({ success: false, error: "Not found." });
    expect(prismaSpies.assessmentResponseAdvisorNote.delete).not.toHaveBeenCalled();
  });

  // The four sub-branches below close the coverage gap on the tenant gate:
  // every mutating sub-branch (intake delete, intake update, assessment
  // create, assessment update) must refuse when the calling advisor lacks
  // an ACTIVE assignment — and none of them should leak an audit row.
  it("refuses intake DELETE when client is not assigned to the calling advisor", async () => {
    prismaSpies.intakeResponse.findUnique.mockResolvedValue({
      id: "ir-1",
      interviewId: "int-1",
      interview: { userId: "client-2" },
    });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    const result = await deleteIntakeResponseAdvisorNote("ir-1");

    expect(result).toEqual({ success: false, error: "Not found." });
    expect(prismaSpies.intakeResponseAdvisorNote.delete).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("refuses intake UPDATE (existing note present) when client is not assigned to the calling advisor", async () => {
    // Pre-existing note exists for SOME advisor on the response — but the
    // calling advisor isn't assigned, so the gate must fire BEFORE the
    // findUnique on the note table is reached, and certainly before update.
    prismaSpies.intakeResponse.findUnique.mockResolvedValue({
      id: "ir-1",
      interviewId: "int-1",
      interview: { userId: "client-2" },
    });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "Trying to overwrite somebody else's note",
    });

    expect(result).toEqual({ success: false, error: "Not found." });
    expect(prismaSpies.intakeResponseAdvisorNote.update).not.toHaveBeenCalled();
    expect(prismaSpies.intakeResponseAdvisorNote.create).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("refuses assessment SAVE (create path) when client is not assigned to the calling advisor", async () => {
    prismaSpies.assessmentResponse.findUnique.mockResolvedValue({
      id: "ar-1",
      assessmentId: "as-1",
      assessment: { userId: "client-2" },
    });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    const result = await saveAssessmentResponseAdvisorNote({
      assessmentResponseId: "ar-1",
      body: "Drive-by note",
    });

    expect(result).toEqual({ success: false, error: "Not found." });
    expect(prismaSpies.assessmentResponseAdvisorNote.create).not.toHaveBeenCalled();
    expect(prismaSpies.assessmentResponseAdvisorNote.update).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("refuses assessment UPDATE (existing note present) when client is not assigned to the calling advisor", async () => {
    prismaSpies.assessmentResponse.findUnique.mockResolvedValue({
      id: "ar-1",
      assessmentId: "as-1",
      assessment: { userId: "client-2" },
    });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    const result = await saveAssessmentResponseAdvisorNote({
      assessmentResponseId: "ar-1",
      body: "Trying to overwrite somebody else's assessment note",
    });

    expect(result).toEqual({ success: false, error: "Not found." });
    expect(prismaSpies.assessmentResponseAdvisorNote.update).not.toHaveBeenCalled();
    expect(prismaSpies.assessmentResponseAdvisorNote.create).not.toHaveBeenCalled();
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("returns Not found (not a distinct error) when the response row is missing — no existence leak", async () => {
    prismaSpies.intakeResponse.findUnique.mockResolvedValue(null);

    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-nope",
      body: "note",
    });

    expect(result).toEqual({ success: false, error: "Not found." });
    expect(prismaSpies.clientAdvisorAssignment.findFirst).not.toHaveBeenCalled();
  });

  // ── intake: create / update / delete ──────────────────────────────────────
  it("creates intake advisor note and audits create", async () => {
    mockAssignedIntakeResponse({ existing: null });
    prismaSpies.intakeResponseAdvisorNote.create.mockResolvedValue({
      id: "note-1",
      body: "Review context",
    });

    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "Review context",
    });

    expect(result).toEqual({ success: true });
    expect(prismaSpies.intakeResponseAdvisorNote.create).toHaveBeenCalledWith({
      data: {
        intakeResponseId: "ir-1",
        advisorId: "advisor-user-1",
        body: "Review context",
        createdByUserId: "advisor-user-1",
        updatedByUserId: "advisor-user-1",
      },
    });
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_CREATE,
        entityType: "IntakeResponseAdvisorNote",
        entityId: "note-1",
      })
    );
  });

  it("updates existing intake advisor note (idempotent on re-save) and audits update", async () => {
    mockAssignedIntakeResponse({ existing: { id: "note-1", body: "Old" } });
    prismaSpies.intakeResponseAdvisorNote.update.mockResolvedValue({
      id: "note-1",
      body: "New",
    });

    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "New",
    });

    expect(result).toEqual({ success: true });
    expect(prismaSpies.intakeResponseAdvisorNote.create).not.toHaveBeenCalled();
    expect(prismaSpies.intakeResponseAdvisorNote.update).toHaveBeenCalled();
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_UPDATE
    );
    expect(writeAuditSpy.mock.calls[0][0].beforeData).toEqual({ body: "Old" });
  });

  it("deletes intake advisor note and audits delete", async () => {
    mockAssignedIntakeResponse({ existing: { id: "note-1", body: "Gone" } });

    const result = await deleteIntakeResponseAdvisorNote("ir-1");

    expect(result).toEqual({ success: true });
    expect(prismaSpies.intakeResponseAdvisorNote.delete).toHaveBeenCalledWith({
      where: { id: "note-1" },
    });
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_DELETE
    );
  });

  it("rejects empty intake note body", async () => {
    // findUnique is never reached when the schema parse fails, but we still
    // need to set up the mock chain in case of regression.
    mockAssignedIntakeResponse({ existing: null });

    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "   ",
    });

    expect(result.success).toBe(false);
    expect(prismaSpies.intakeResponseAdvisorNote.create).not.toHaveBeenCalled();
  });

  it("recovers from a P2002 unique-conflict race by promoting create → update", async () => {
    mockAssignedIntakeResponse({ existing: null });
    const conflict = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
    });
    prismaSpies.intakeResponseAdvisorNote.create.mockRejectedValueOnce(conflict);
    prismaSpies.intakeResponseAdvisorNote.update.mockResolvedValueOnce({
      id: "note-1",
      body: "Late",
    });

    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "Late",
    });

    expect(result).toEqual({ success: true });
    expect(prismaSpies.intakeResponseAdvisorNote.update).toHaveBeenCalled();
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_UPDATE
    );
    expect(writeAuditSpy.mock.calls[0][0].metadata.raceRecovery).toBe(true);
  });

  // ── assessment: create / delete ───────────────────────────────────────────
  it("creates assessment advisor note and audits create", async () => {
    mockAssignedAssessmentResponse({ existing: null });
    prismaSpies.assessmentResponseAdvisorNote.create.mockResolvedValue({
      id: "note-2",
      body: "Pillar review",
    });

    const result = await saveAssessmentResponseAdvisorNote({
      assessmentResponseId: "ar-1",
      body: "Pillar review",
    });

    expect(result).toEqual({ success: true });
    expect(prismaSpies.assessmentResponseAdvisorNote.create).toHaveBeenCalledWith({
      data: {
        assessmentResponseId: "ar-1",
        advisorId: "advisor-user-1",
        body: "Pillar review",
        createdByUserId: "advisor-user-1",
        updatedByUserId: "advisor-user-1",
      },
    });
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.ASSESSMENT_RESPONSE_ADVISOR_NOTE_CREATE
    );
  });

  it("deletes assessment advisor note and audits delete", async () => {
    mockAssignedAssessmentResponse({ existing: { id: "note-2", body: "Remove me" } });

    const result = await deleteAssessmentResponseAdvisorNote("ar-1");

    expect(result).toEqual({ success: true });
    expect(prismaSpies.assessmentResponseAdvisorNote.delete).toHaveBeenCalledWith({
      where: { id: "note-2" },
    });
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.ASSESSMENT_RESPONSE_ADVISOR_NOTE_DELETE
    );
  });

  // Mirrors the intake update-on-re-save test: a pre-existing assessment
  // note row triggers the update branch (not create), and the audit row
  // carries the prior body in beforeData so the audit trail captures what
  // was overwritten.
  it("updates existing assessment advisor note (idempotent on re-save) and audits update", async () => {
    mockAssignedAssessmentResponse({
      existing: { id: "note-2", body: "Old assessment note" },
    });
    prismaSpies.assessmentResponseAdvisorNote.update.mockResolvedValue({
      id: "note-2",
      body: "New assessment note",
    });

    const result = await saveAssessmentResponseAdvisorNote({
      assessmentResponseId: "ar-1",
      body: "New assessment note",
    });

    expect(result).toEqual({ success: true });
    expect(prismaSpies.assessmentResponseAdvisorNote.create).not.toHaveBeenCalled();
    expect(prismaSpies.assessmentResponseAdvisorNote.update).toHaveBeenCalled();
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.ASSESSMENT_RESPONSE_ADVISOR_NOTE_UPDATE
    );
    expect(writeAuditSpy.mock.calls[0][0].beforeData).toEqual({
      body: "Old assessment note",
    });
  });

  // ── audit metadata depth ──────────────────────────────────────────────────
  // The existing happy-path tests assert action + entityType only. The audit
  // contract for US-46c also requires that downstream consumers can trace
  // every note write back to its parent response AND its parent
  // interview/assessment without joining another table. Pin the full
  // metadata shape so we notice if a refactor drops a key.
  it("intake create audit metadata carries responseId, interviewId, clientId, advisorId", async () => {
    mockAssignedIntakeResponse({ existing: null });
    prismaSpies.intakeResponseAdvisorNote.create.mockResolvedValue({
      id: "note-1",
      body: "metadata depth",
    });

    await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "metadata depth",
    });

    const auditPayload = writeAuditSpy.mock.calls[0][0];
    expect(auditPayload.entityType).toBe("IntakeResponseAdvisorNote");
    expect(auditPayload.entityId).toBe("note-1");
    expect(auditPayload.metadata).toEqual({
      intakeResponseId: "ir-1",
      interviewId: "int-1",
      clientId: "client-1",
      advisorId: "advisor-user-1",
    });
  });

  it("assessment create audit metadata carries responseId, assessmentId, clientId, advisorId", async () => {
    mockAssignedAssessmentResponse({ existing: null });
    prismaSpies.assessmentResponseAdvisorNote.create.mockResolvedValue({
      id: "note-2",
      body: "metadata depth",
    });

    await saveAssessmentResponseAdvisorNote({
      assessmentResponseId: "ar-1",
      body: "metadata depth",
    });

    const auditPayload = writeAuditSpy.mock.calls[0][0];
    expect(auditPayload.entityType).toBe("AssessmentResponseAdvisorNote");
    expect(auditPayload.entityId).toBe("note-2");
    expect(auditPayload.metadata).toEqual({
      assessmentResponseId: "ar-1",
      assessmentId: "as-1",
      clientId: "client-1",
      advisorId: "advisor-user-1",
    });
  });

  // ── coexistence with admin notes ──────────────────────────────────────────
  it("never touches the admin-note tables on write", async () => {
    mockAssignedIntakeResponse({ existing: null });
    prismaSpies.intakeResponseAdvisorNote.create.mockResolvedValue({
      id: "note-1",
      body: "Body",
    });

    await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "Body",
    });

    // Sanity-check: the admin-note delegate isn't even on the mocked prisma
    // (we only set up advisor-note + clientAdvisorAssignment), so any
    // accidental call would fail with "undefined is not a function". This
    // test additionally guards against future refactors that might lump
    // the two channels together.
    expect(
      (prismaSpies as unknown as Record<string, unknown>).intakeResponseAdminNote
    ).toBeUndefined();
  });

  it("creates a placeholder intake response when noting an unanswered question", async () => {
    mockAssignedIntakeQuestion();
    prismaSpies.intakeResponse.upsert.mockResolvedValue({ id: "ir-1" });
    mockAssignedIntakeResponse({ existing: null });
    prismaSpies.intakeResponseAdvisorNote.create.mockResolvedValue({
      id: "note-1",
      body: "Ask about council cadence on next call.",
    });

    const result = await saveIntakeQuestionAdvisorNote({
      interviewId: "int-1",
      questionId: "intake-q7",
      body: "Ask about council cadence on next call.",
    });

    expect(result).toEqual({ success: true });
    expect(prismaSpies.intakeResponse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          interviewId_questionId: {
            interviewId: "int-1",
            questionId: "intake-q7",
          },
        },
      }),
    );
    expect(prismaSpies.intakeResponseAdvisorNote.create).toHaveBeenCalled();
  });
});
