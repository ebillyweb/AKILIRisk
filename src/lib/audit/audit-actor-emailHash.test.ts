/**
 * Round-11 commit 2.4a (BRD §5.1.AUTH / phase B — soft-drop step 1) —
 * writeAudit's actorEmailHash equivalence test.
 *
 * The dual-input AuditActor lets call sites pass EITHER plaintext
 * `email` (legacy + session-scoped sites) OR `emailCiphertext` (sites
 * that read the User row and want to depend only on the post-flip
 * authoritative column). Both inputs must produce a byte-identical
 * `actorEmailHash` value when given the same logical email — that's
 * what keeps the admin audit-log filter UI working across the flip.
 *
 * vi.hoisted() pattern for the auditLogCreate spy because the
 * vi.mock factory is hoisted to top-of-file.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const TEST_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";

const { auditLogCreate } = vi.hoisted(() => ({
  auditLogCreate: vi.fn<
    (args: { data: { actorEmailHash: string | null } }) => Promise<{ id: string }>
  >(async () => ({ id: "audit-1" })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: auditLogCreate,
    },
  },
}));

import { writeAudit, AUDIT_ACTIONS } from "./audit-log";
import { userEmailCiphertext } from "@/lib/auth/user-email";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  auditLogCreate.mockClear();
});

describe("writeAudit actorEmailHash equivalence", () => {
  it("plaintext-input and ciphertext-input yield the same actorEmailHash", async () => {
    const email = "actor-equiv@example.com";

    await writeAudit({
      actor: { userId: "u-1", role: "USER", email },
      action: AUDIT_ACTIONS.AUTH_SIGNIN_SUCCESS,
      entityType: "User",
      entityId: "u-1",
    });
    const plaintextCall = auditLogCreate.mock.calls[0]![0];

    auditLogCreate.mockClear();

    await writeAudit({
      actor: {
        userId: "u-1",
        role: "USER",
        emailCiphertext: userEmailCiphertext(email),
      },
      action: AUDIT_ACTIONS.AUTH_SIGNIN_SUCCESS,
      entityType: "User",
      entityId: "u-1",
    });
    const ciphertextCall = auditLogCreate.mock.calls[0]![0];

    expect(plaintextCall.data.actorEmailHash).not.toBeNull();
    expect(ciphertextCall.data.actorEmailHash).toEqual(
      plaintextCall.data.actorEmailHash
    );
  });

  it("ciphertext-input wins when both are passed (defensive)", async () => {
    const intendedEmail = "ciphertext-wins@example.com";
    const decoyPlaintext = "decoy@example.com";

    await writeAudit({
      actor: {
        userId: "u-2",
        role: "ADMIN",
        email: decoyPlaintext,
        emailCiphertext: userEmailCiphertext(intendedEmail),
      },
      action: AUDIT_ACTIONS.AUTH_SIGNIN_SUCCESS,
      entityType: "User",
      entityId: "u-2",
    });

    const dualInputHash = auditLogCreate.mock.calls[0]![0].data.actorEmailHash;

    auditLogCreate.mockClear();

    await writeAudit({
      actor: {
        userId: "u-2",
        role: "ADMIN",
        email: intendedEmail,
      },
      action: AUDIT_ACTIONS.AUTH_SIGNIN_SUCCESS,
      entityType: "User",
      entityId: "u-2",
    });

    const intendedHash = auditLogCreate.mock.calls[0]![0].data.actorEmailHash;

    expect(dualInputHash).toEqual(intendedHash);
  });

  it("null actor produces null actorEmailHash", async () => {
    await writeAudit({
      actor: { userId: null },
      action: AUDIT_ACTIONS.AUTH_SIGNIN_SUCCESS,
      entityType: "User",
      entityId: null,
    });

    const call = auditLogCreate.mock.calls[0]![0];
    expect(call.data.actorEmailHash).toBeNull();
  });
});
