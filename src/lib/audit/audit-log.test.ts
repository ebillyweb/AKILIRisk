import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Prisma client BEFORE importing audit-log.ts (which imports it).
// We capture the create() call to assert the row shape.
const createSpy = vi.fn().mockResolvedValue({ id: "log-1" });
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => createSpy(...args),
    },
  },
}));

import { writeAudit, AUDIT_ACTIONS } from "./audit-log";
import { shortEmailHash } from "./redact";

beforeEach(() => {
  createSpy.mockClear();
});

describe("writeAudit", () => {
  it("populates actor fields including hashed email", async () => {
    await writeAudit({
      actor: { userId: "user-1", role: "ADMIN", email: "Admin@Example.com" },
      action: AUDIT_ACTIONS.USER_CREATE,
      entityType: "User",
      entityId: "new-user-1",
      beforeData: null,
      afterData: { id: "new-user-1", role: "ADVISOR" },
    });

    expect(createSpy).toHaveBeenCalledOnce();
    const row = createSpy.mock.calls[0][0].data;
    expect(row.actorUserId).toBe("user-1");
    expect(row.actorRole).toBe("ADMIN");
    expect(row.actorEmailHash).toBe(shortEmailHash("admin@example.com"));
    expect(row.action).toBe("user.create");
    expect(row.entityType).toBe("User");
    expect(row.entityId).toBe("new-user-1");
  });

  it("redacts secret/email fields in beforeData and afterData", async () => {
    await writeAudit({
      actor: { userId: "user-1" },
      action: AUDIT_ACTIONS.USER_UPDATE,
      entityType: "User",
      entityId: "target-user",
      beforeData: { password: "old-hash", email: "before@example.com" },
      afterData: { password: "new-hash", email: "after@example.com" },
    });

    const row = createSpy.mock.calls[0][0].data;
    expect(row.beforeData).toEqual({
      password: "[REDACTED]",
      email: { emailHash: shortEmailHash("before@example.com") },
    });
    expect(row.afterData).toEqual({
      password: "[REDACTED]",
      email: { emailHash: shortEmailHash("after@example.com") },
    });
  });

  it("supports system actions (null actor)", async () => {
    await writeAudit({
      actor: { userId: null },
      action: AUDIT_ACTIONS.SYSTEM_RETENTION_SWEEP,
      entityType: "AuditLog",
      metadata: { deletedRows: 100 },
    });

    const row = createSpy.mock.calls[0][0].data;
    expect(row.actorUserId).toBeNull();
    expect(row.actorRole).toBeNull();
    expect(row.actorEmailHash).toBeNull();
    expect(row.metadata).toEqual({ deletedRows: 100 });
  });

  it("captures truncated ipAddress and userAgent when request is provided", async () => {
    const headers = new Headers();
    headers.set("x-forwarded-for", "192.168.1.45");
    headers.set("user-agent", "Mozilla/5.0 ".repeat(50)); // > 256 chars
    const fakeRequest = { headers };

    await writeAudit({
      actor: { userId: "user-1" },
      action: AUDIT_ACTIONS.AUTH_SIGNIN_SUCCESS,
      entityType: "User",
      entityId: "user-1",
      request: fakeRequest as Request,
    });

    const row = createSpy.mock.calls[0][0].data;
    expect(row.ipAddress).toBe("192.168.1.0");
    expect(row.userAgent).toHaveLength(256);
  });

  it("never throws on Prisma failure (audit must not break the action)", async () => {
    createSpy.mockRejectedValueOnce(new Error("DB down"));
    // Suppress the console.error spam from the catch path.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      writeAudit({
        actor: { userId: "u" },
        action: AUDIT_ACTIONS.USER_CREATE,
        entityType: "User",
      })
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("treats undefined beforeData/afterData as null", async () => {
    await writeAudit({
      actor: { userId: "u" },
      action: AUDIT_ACTIONS.DATA_ACCESS_AUDIT_LOG_VIEW,
      entityType: "AuditLog",
      // beforeData and afterData both omitted — read event.
    });

    const row = createSpy.mock.calls[0][0].data;
    expect(row.beforeData).toBeNull();
    expect(row.afterData).toBeNull();
  });
});

describe("AUDIT_ACTIONS vocabulary", () => {
  it("uses noun.verb dot-separated format consistently", () => {
    for (const value of Object.values(AUDIT_ACTIONS)) {
      expect(value).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  it("has no duplicate values", () => {
    const values = Object.values(AUDIT_ACTIONS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
