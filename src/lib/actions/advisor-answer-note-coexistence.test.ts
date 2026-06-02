import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * US-46c × US-46b coexistence pinning. The two notes (admin from US-46b
 * and advisor from US-46c) live on separate tables and separate write
 * paths. This file pins three invariants that hold when both rows exist
 * on the same `IntakeResponse`:
 *
 *   1. An advisor save (`saveIntakeResponseAdvisorNote`) never touches
 *      the admin-note delegate — even when the response already has an
 *      admin note attached.
 *   2. An admin save (`saveIntakeResponseAdminNote`) still works after an
 *      advisor note exists — i.e. the advisor channel didn't introduce a
 *      regression that confuses the admin lookup.
 *   3. The two writes route to separate prisma delegates and emit
 *      separate audit `entityType` values so downstream consumers can
 *      tell which channel wrote which row.
 */

const {
  prismaSpies,
  writeAuditSpy,
  requireAdvisorRoleSpy,
  getAdvisorProfileOrThrowSpy,
  requireAdminRoleSpy,
} = vi.hoisted(() => ({
  prismaSpies: {
    // Both channel tables present on the same mocked prisma — this is
    // the whole point: the two writes must not cross-contaminate.
    intakeResponse: { findUnique: vi.fn() },
    intakeResponseAdvisorNote: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    intakeResponseAdminNote: {
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
vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: () => requireAdvisorRoleSpy(),
  getAdvisorProfileOrThrow: (userId: string) =>
    getAdvisorProfileOrThrowSpy(userId),
}));
vi.mock("@/lib/admin/auth", () => ({
  requireAdminRole: () => requireAdminRoleSpy(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveIntakeResponseAdvisorNote } from "./advisor-answer-note-actions";
import { saveIntakeResponseAdminNote } from "./admin-answer-note-actions";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdvisorRoleSpy.mockResolvedValue({
    userId: "advisor-user-1",
    email: "advisor@test.com",
    role: "ADVISOR",
  });
  getAdvisorProfileOrThrowSpy.mockResolvedValue({ id: "advisor-profile-1" });
  requireAdminRoleSpy.mockResolvedValue({
    userId: "admin-1",
    email: "admin@test.com",
    role: "ADMIN",
  });
});

describe("advisor + admin answer notes coexist on the same IntakeResponse", () => {
  it("advisor save does not touch the admin-note delegate (even when an admin note already exists)", async () => {
    // Advisor channel reads the response without the admin-note relation —
    // its findUnique select shape from advisor-answer-note-actions only
    // pulls (id, interviewId, interview.userId). We model that here.
    prismaSpies.intakeResponse.findUnique.mockResolvedValue({
      id: "ir-1",
      interviewId: "int-1",
      interview: { userId: "client-1" },
    });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({
      id: "a-1",
    });
    prismaSpies.intakeResponseAdvisorNote.findUnique.mockResolvedValue(null);
    prismaSpies.intakeResponseAdvisorNote.create.mockResolvedValue({
      id: "advisor-note-1",
      body: "Advisor view",
    });

    const result = await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "Advisor view",
    });
    expect(result).toEqual({ success: true });

    // Advisor channel wrote on the advisor table only.
    expect(prismaSpies.intakeResponseAdvisorNote.create).toHaveBeenCalledTimes(1);

    // Admin-note delegate untouched on every method.
    expect(prismaSpies.intakeResponseAdminNote.create).not.toHaveBeenCalled();
    expect(prismaSpies.intakeResponseAdminNote.update).not.toHaveBeenCalled();
    expect(prismaSpies.intakeResponseAdminNote.delete).not.toHaveBeenCalled();
    expect(prismaSpies.intakeResponseAdminNote.findUnique).not.toHaveBeenCalled();

    // Audit row carries the advisor-channel entityType — not the admin one.
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.INTAKE_RESPONSE_ADVISOR_NOTE_CREATE,
        entityType: "IntakeResponseAdvisorNote",
      })
    );
  });

  it("admin save still works after an advisor note exists (no regression in the admin channel)", async () => {
    // Admin channel pulls the admin-note relation directly off the
    // intake-response row. The advisor note's presence is irrelevant to
    // the admin lookup — the admin select shape doesn't even ask for it.
    prismaSpies.intakeResponse.findUnique.mockResolvedValue({
      id: "ir-1",
      interviewId: "int-1",
      adminNote: null, // no admin note yet — create branch
    });
    prismaSpies.intakeResponseAdminNote.create.mockResolvedValue({
      id: "admin-note-1",
      body: "Admin view",
    });

    const result = await saveIntakeResponseAdminNote({
      intakeResponseId: "ir-1",
      body: "Admin view",
    });
    expect(result).toEqual({ success: true });

    // Admin channel wrote on the admin table only.
    expect(prismaSpies.intakeResponseAdminNote.create).toHaveBeenCalledTimes(1);

    // Advisor-note delegate untouched.
    expect(prismaSpies.intakeResponseAdvisorNote.create).not.toHaveBeenCalled();
    expect(prismaSpies.intakeResponseAdvisorNote.update).not.toHaveBeenCalled();
    expect(prismaSpies.intakeResponseAdvisorNote.delete).not.toHaveBeenCalled();

    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.INTAKE_RESPONSE_NOTE_CREATE,
        entityType: "IntakeResponseAdminNote",
      })
    );
  });

  it("advisor update + admin update in sequence emit two audit rows, one per channel", async () => {
    // Sequence: advisor saves first, then admin saves on the same
    // response. The audit log must capture both as distinct rows with
    // distinct entityTypes — that's how the audit consumer differentiates
    // "advisor commented" from "platform staff annotated".
    prismaSpies.intakeResponse.findUnique
      .mockResolvedValueOnce({
        // First call: advisor channel.
        id: "ir-1",
        interviewId: "int-1",
        interview: { userId: "client-1" },
      })
      .mockResolvedValueOnce({
        // Second call: admin channel.
        id: "ir-1",
        interviewId: "int-1",
        adminNote: null,
      });

    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({
      id: "a-1",
    });
    prismaSpies.intakeResponseAdvisorNote.findUnique.mockResolvedValue(null);
    prismaSpies.intakeResponseAdvisorNote.create.mockResolvedValue({
      id: "advisor-note-1",
      body: "Advisor view",
    });
    prismaSpies.intakeResponseAdminNote.create.mockResolvedValue({
      id: "admin-note-1",
      body: "Admin view",
    });

    await saveIntakeResponseAdvisorNote({
      intakeResponseId: "ir-1",
      body: "Advisor view",
    });
    await saveIntakeResponseAdminNote({
      intakeResponseId: "ir-1",
      body: "Admin view",
    });

    expect(writeAuditSpy).toHaveBeenCalledTimes(2);
    const entityTypes = writeAuditSpy.mock.calls.map(
      (call) => (call[0] as { entityType: string }).entityType
    );
    expect(entityTypes).toEqual([
      "IntakeResponseAdvisorNote",
      "IntakeResponseAdminNote",
    ]);
  });
});
