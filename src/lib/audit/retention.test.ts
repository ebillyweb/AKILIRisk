import { describe, it, expect, vi, beforeEach } from "vitest";

const deleteManySpy = vi.fn().mockResolvedValue({ count: 42 });
const createSpy = vi.fn().mockResolvedValue({ id: "log-1" });
vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      deleteMany: (...args: unknown[]) => deleteManySpy(...args),
      create: (...args: unknown[]) => createSpy(...args),
    },
  },
}));

import {
  DEFAULT_AUDIT_RETENTION_DAYS,
  resolveRetentionDays,
  runAuditLogRetentionSweep,
} from "./retention";

beforeEach(() => {
  deleteManySpy.mockClear();
  createSpy.mockClear();
});

describe("resolveRetentionDays", () => {
  it("returns the default when env is unset", () => {
    expect(resolveRetentionDays(undefined)).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    expect(resolveRetentionDays(null)).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    expect(resolveRetentionDays("")).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
  });

  it("parses valid integers", () => {
    expect(resolveRetentionDays("90")).toBe(90);
    expect(resolveRetentionDays("365")).toBe(365);
    expect(resolveRetentionDays("2555")).toBe(2555);
  });

  it("falls back to default for malformed values", () => {
    expect(resolveRetentionDays("not-a-number")).toBe(
      DEFAULT_AUDIT_RETENTION_DAYS
    );
    expect(resolveRetentionDays("0")).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
    expect(resolveRetentionDays("-30")).toBe(DEFAULT_AUDIT_RETENTION_DAYS);
  });

  it("floors fractional values", () => {
    expect(resolveRetentionDays("90.7")).toBe(90);
  });
});

describe("runAuditLogRetentionSweep", () => {
  it("calls deleteMany with a cutoff matching retentionDays", async () => {
    const before = Date.now();
    await runAuditLogRetentionSweep(30);
    const after = Date.now();

    expect(deleteManySpy).toHaveBeenCalledOnce();
    const where = deleteManySpy.mock.calls[0][0].where;
    expect(where.createdAt.lt).toBeInstanceOf(Date);

    const cutoff = (where.createdAt.lt as Date).getTime();
    const expectedMin = before - 30 * 24 * 60 * 60 * 1000;
    const expectedMax = after - 30 * 24 * 60 * 60 * 1000;
    expect(cutoff).toBeGreaterThanOrEqual(expectedMin);
    expect(cutoff).toBeLessThanOrEqual(expectedMax);
  });

  it("writes one system.retention_sweep audit row with deletion count", async () => {
    const result = await runAuditLogRetentionSweep(90);

    expect(result.deletedRows).toBe(42);
    expect(result.retentionDays).toBe(90);

    expect(createSpy).toHaveBeenCalledOnce();
    const auditRow = createSpy.mock.calls[0][0].data;
    expect(auditRow.action).toBe("system.retention_sweep");
    expect(auditRow.entityType).toBe("AuditLog");
    expect(auditRow.actorUserId).toBeNull();
    expect(auditRow.metadata).toMatchObject({
      retentionDays: 90,
      deletedRows: 42,
    });
  });

  it("self-audit row is created AFTER deleteMany (so the new row isn't itself swept)", async () => {
    await runAuditLogRetentionSweep(30);
    const deleteCallOrder = deleteManySpy.mock.invocationCallOrder[0];
    const createCallOrder = createSpy.mock.invocationCallOrder[0];
    expect(deleteCallOrder).toBeLessThan(createCallOrder);
  });
});
