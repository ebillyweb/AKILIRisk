import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaSpies, writeAuditSpy, requireAdminRoleSpy } = vi.hoisted(() => ({
  prismaSpies: {
    intakeResponse: { findUnique: vi.fn() },
    intakeResponseAdminNote: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    assessmentResponse: { findUnique: vi.fn() },
    assessmentResponseAdminNote: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  writeAuditSpy: vi.fn().mockResolvedValue(undefined),
  requireAdminRoleSpy: vi.fn().mockResolvedValue({
    userId: "admin-1",
    email: "admin@test.com",
    role: "ADMIN",
  }),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/audit-log")>(
    "@/lib/audit/audit-log"
  );
  return { ...actual, writeAudit: (...args: unknown[]) => writeAuditSpy(...args) };
});
vi.mock("@/lib/admin/auth", () => ({
  requireAdminRole: () => requireAdminRoleSpy(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  saveIntakeResponseAdminNote,
  deleteIntakeResponseAdminNote,
  saveAssessmentResponseAdminNote,
  deleteAssessmentResponseAdminNote,
} from "./admin-answer-note-actions";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminRoleSpy.mockResolvedValue({
    userId: "admin-1",
    email: "admin@test.com",
    role: "ADMIN",
  });
});

describe("admin answer notes (US-46b)", () => {
  it("creates intake note and audits create", async () => {
    prismaSpies.intakeResponse.findUnique.mockResolvedValue({
      id: "ir-1",
      interviewId: "int-1",
      adminNote: null,
    });
    prismaSpies.intakeResponseAdminNote.create.mockResolvedValue({
      id: "note-1",
      body: "Review context",
    });

    const result = await saveIntakeResponseAdminNote({
      intakeResponseId: "ir-1",
      body: "Review context",
    });

    expect(result).toEqual({ success: true });
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.INTAKE_RESPONSE_NOTE_CREATE,
        entityType: "IntakeResponseAdminNote",
      })
    );
  });

  it("updates existing intake note and audits update", async () => {
    prismaSpies.intakeResponse.findUnique.mockResolvedValue({
      id: "ir-1",
      interviewId: "int-1",
      adminNote: { id: "note-1", body: "Old" },
    });
    prismaSpies.intakeResponseAdminNote.update.mockResolvedValue({
      id: "note-1",
      body: "New",
    });

    const result = await saveIntakeResponseAdminNote({
      intakeResponseId: "ir-1",
      body: "New",
    });

    expect(result).toEqual({ success: true });
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.INTAKE_RESPONSE_NOTE_UPDATE
    );
    expect(writeAuditSpy.mock.calls[0][0].beforeData).toEqual({ body: "Old" });
  });

  it("deletes intake note and audits delete", async () => {
    prismaSpies.intakeResponse.findUnique.mockResolvedValue({
      id: "ir-1",
      interviewId: "int-1",
      adminNote: { id: "note-1", body: "Gone" },
    });

    const result = await deleteIntakeResponseAdminNote("ir-1");

    expect(result).toEqual({ success: true });
    expect(prismaSpies.intakeResponseAdminNote.delete).toHaveBeenCalledWith({
      where: { id: "note-1" },
    });
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.INTAKE_RESPONSE_NOTE_DELETE
    );
  });

  it("rejects empty note body", async () => {
    const result = await saveIntakeResponseAdminNote({
      intakeResponseId: "ir-1",
      body: "   ",
    });
    expect(result.success).toBe(false);
    expect(prismaSpies.intakeResponseAdminNote.create).not.toHaveBeenCalled();
  });

  it("creates assessment note and audits create", async () => {
    prismaSpies.assessmentResponse.findUnique.mockResolvedValue({
      id: "ar-1",
      assessmentId: "as-1",
      adminNote: null,
    });
    prismaSpies.assessmentResponseAdminNote.create.mockResolvedValue({
      id: "note-2",
      body: "Pillar review",
    });

    const result = await saveAssessmentResponseAdminNote({
      assessmentResponseId: "ar-1",
      body: "Pillar review",
    });

    expect(result).toEqual({ success: true });
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.ASSESSMENT_RESPONSE_NOTE_CREATE
    );
  });

  it("deletes assessment note and audits delete", async () => {
    prismaSpies.assessmentResponse.findUnique.mockResolvedValue({
      id: "ar-1",
      assessmentId: "as-1",
      adminNote: { id: "note-2", body: "Remove me" },
    });

    const result = await deleteAssessmentResponseAdminNote("ar-1");

    expect(result).toEqual({ success: true });
    expect(writeAuditSpy.mock.calls[0][0].action).toBe(
      AUDIT_ACTIONS.ASSESSMENT_RESPONSE_NOTE_DELETE
    );
  });
});
