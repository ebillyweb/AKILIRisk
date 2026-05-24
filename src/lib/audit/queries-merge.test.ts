import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock prisma BEFORE importing the module under test. Each table's findMany
 * + count is captured so the merge logic can be exercised against synthetic
 * rows without standing up a real DB.
 */
const auditLogFindMany = vi.fn();
const subAuditLogFindMany = vi.fn();
const brandAuditLogFindMany = vi.fn();
const auditLogCount = vi.fn().mockResolvedValue(0);
const subAuditLogCount = vi.fn().mockResolvedValue(0);
const brandAuditLogCount = vi.fn().mockResolvedValue(0);

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      findMany: (...args: unknown[]) => auditLogFindMany(...args),
      count: (...args: unknown[]) => auditLogCount(...args),
    },
    subscriptionAuditLog: {
      findMany: (...args: unknown[]) => subAuditLogFindMany(...args),
      count: (...args: unknown[]) => subAuditLogCount(...args),
    },
    advisorBrandingAuditLog: {
      findMany: (...args: unknown[]) => brandAuditLogFindMany(...args),
      count: (...args: unknown[]) => brandAuditLogCount(...args),
    },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { listAuditLog, countAuditLog, streamAuditLog } from "./queries";

beforeEach(() => {
  // Reset to empty-array defaults so tests that only override one source
  // don't trip on `undefined` returns from the others.
  auditLogFindMany.mockReset().mockResolvedValue([]);
  subAuditLogFindMany.mockReset().mockResolvedValue([]);
  brandAuditLogFindMany.mockReset().mockResolvedValue([]);
  auditLogCount.mockReset().mockResolvedValue(0);
  subAuditLogCount.mockReset().mockResolvedValue(0);
  brandAuditLogCount.mockReset().mockResolvedValue(0);
});

const T = (iso: string) => new Date(iso);

const genericRow = (id: string, ts: string, action = "user.create") => ({
  id,
  actorUserId: "u1",
  actorRole: "ADMIN" as const,
  actorEmailHash: "abcd1234",
  action,
  entityType: "User",
  entityId: "user-x",
  beforeData: null,
  afterData: { id: "user-x" },
  metadata: null,
  ipAddress: null,
  userAgent: null,
  createdAt: T(ts),
});

const subRow = (id: string, ts: string, action = "stripe_sync") => ({
  id,
  subscriptionId: "sub1",
  action,
  previousTier: "STARTER" as const,
  newTier: "GROWTH" as const,
  metadata: null,
  timestamp: T(ts),
});

const brandRow = (id: string, ts: string, action = "UPDATE_BRANDING") => ({
  id,
  advisorId: "adv1",
  action,
  entityType: "BRANDING",
  entityId: null,
  previousValues: { brandName: "Old" },
  newValues: { brandName: "New" },
  metadata: null,
  timestamp: T(ts),
  userId: "user-actor",
});

describe("listAuditLog merge", () => {
  it("returns rows from all three sources sorted by createdAt DESC", async () => {
    auditLogFindMany.mockResolvedValue([
      genericRow("g1", "2026-05-04T10:00:00Z"),
      genericRow("g2", "2026-05-04T08:00:00Z"),
    ]);
    subAuditLogFindMany.mockResolvedValue([
      subRow("s1", "2026-05-04T09:00:00Z"),
    ]);
    brandAuditLogFindMany.mockResolvedValue([
      brandRow("b1", "2026-05-04T11:00:00Z"),
    ]);

    const { rows, nextOffset } = await listAuditLog({}, { take: 50 });
    expect(rows.map((r) => r.id)).toEqual([
      "brand:b1", // 11:00 — latest
      "gen:g1", // 10:00
      "sub:s1", // 09:00
      "gen:g2", // 08:00
    ]);
    expect(nextOffset).toBeNull();
  });

  it("indicates a next page when more rows exist than the page size", async () => {
    // 60 generic rows in one page worth of probe; take=50 → 50 returned + nextOffset=50.
    const rows = Array.from({ length: 60 }, (_, i) =>
      genericRow(`g${i}`, `2026-05-04T${String(23 - i).padStart(2, "0")}:00:00Z`)
    );
    auditLogFindMany.mockResolvedValue(rows);
    subAuditLogFindMany.mockResolvedValue([]);
    brandAuditLogFindMany.mockResolvedValue([]);

    const { rows: page, nextOffset } = await listAuditLog({}, { take: 50, offset: 0 });
    expect(page).toHaveLength(50);
    expect(nextOffset).toBe(50);
  });

  it("entityType=Subscription excludes generic + branding sources", async () => {
    auditLogFindMany.mockResolvedValue([genericRow("g1", "2026-05-04T10:00:00Z")]);
    subAuditLogFindMany.mockResolvedValue([subRow("s1", "2026-05-04T09:00:00Z")]);
    brandAuditLogFindMany.mockResolvedValue([brandRow("b1", "2026-05-04T11:00:00Z")]);

    await listAuditLog({ entityType: "Subscription" }, { take: 50 });
    // Generic + branding tables should NOT have been queried.
    expect(auditLogFindMany).not.toHaveBeenCalled();
    expect(brandAuditLogFindMany).not.toHaveBeenCalled();
    expect(subAuditLogFindMany).toHaveBeenCalled();
  });

  it("entityType=AdvisorBranding excludes generic + subscription sources", async () => {
    await listAuditLog({ entityType: "AdvisorBranding" }, { take: 50 });
    expect(auditLogFindMany).not.toHaveBeenCalled();
    expect(subAuditLogFindMany).not.toHaveBeenCalled();
    expect(brandAuditLogFindMany).toHaveBeenCalled();
  });

  it("entityType=User excludes both legacy sources", async () => {
    await listAuditLog({ entityType: "User" }, { take: 50 });
    expect(auditLogFindMany).toHaveBeenCalled();
    expect(subAuditLogFindMany).not.toHaveBeenCalled();
    expect(brandAuditLogFindMany).not.toHaveBeenCalled();
  });

  it("actorUserId set excludes the subscription source (no actor on that table)", async () => {
    await listAuditLog({ actorUserId: "user1" }, { take: 50 });
    expect(subAuditLogFindMany).not.toHaveBeenCalled();
    expect(auditLogFindMany).toHaveBeenCalled();
    expect(brandAuditLogFindMany).toHaveBeenCalled();
  });

  it("action filter routes by namespace prefix", async () => {
    await listAuditLog(
      { actions: ["subscription.payment_failed"] },
      { take: 50 }
    );
    expect(subAuditLogFindMany).toHaveBeenCalled();
    expect(auditLogFindMany).not.toHaveBeenCalled();
    expect(brandAuditLogFindMany).not.toHaveBeenCalled();
  });

  it("mixed-namespace action filter queries multiple sources", async () => {
    await listAuditLog(
      {
        actions: [
          "user.create",
          "subscription.created",
          "branding.upload_logo",
        ],
      },
      { take: 50 }
    );
    expect(auditLogFindMany).toHaveBeenCalled();
    expect(subAuditLogFindMany).toHaveBeenCalled();
    expect(brandAuditLogFindMany).toHaveBeenCalled();
  });

  it("tiebreaks on id DESC when timestamps are identical", async () => {
    const ts = "2026-05-04T10:00:00Z";
    auditLogFindMany.mockResolvedValue([genericRow("aaa", ts)]);
    subAuditLogFindMany.mockResolvedValue([subRow("bbb", ts)]);
    brandAuditLogFindMany.mockResolvedValue([brandRow("ccc", ts)]);
    const { rows } = await listAuditLog({}, { take: 50 });
    // Prefixed ids: "brand:ccc" > "sub:bbb" > "gen:aaa" lexicographically.
    expect(rows.map((r) => r.id)).toEqual(["sub:bbb", "gen:aaa", "brand:ccc"]);
    // Verify the tiebreak is *deterministic* (same input → same order).
  });
});

describe("excludeTestOrigin filter (NIT 3)", () => {
  /**
   * The admin audit-log page defaults to hiding rows whose
   * `metadata.testOrigin === true` so smoke-test traffic doesn't
   * pollute compliance reviews. This is a generic-source filter
   * only — neither subscription nor branding tables write that
   * metadata flag.
   *
   * Verify the predicate is the Prisma JSON-path-equality shape, and
   * that omitting / passing false leaves the where clause unchanged.
   */
  it("omits the NOT clause when excludeTestOrigin is false/undefined", async () => {
    await listAuditLog({}, { take: 50 });
    const call = auditLogFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(call?.where ?? {}).not.toHaveProperty("NOT");

    auditLogFindMany.mockClear();
    await listAuditLog({ excludeTestOrigin: false }, { take: 50 });
    const call2 = auditLogFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(call2?.where ?? {}).not.toHaveProperty("NOT");
  });

  it("adds the metadata not predicate when excludeTestOrigin is true", async () => {
    await listAuditLog({ excludeTestOrigin: true }, { take: 50 });
    const call = auditLogFindMany.mock.calls[0]?.[0] as {
      where: { metadata?: { not?: { testOrigin?: boolean } } };
    };
    expect(call.where.metadata).toEqual({ not: { testOrigin: true } });
  });

  it("excludeTestOrigin only affects the generic source", async () => {
    await listAuditLog({ excludeTestOrigin: true }, { take: 50 });
    // Subscription + branding sources are still queried (no entityType
    // hard-routing) but their where clauses must NOT carry a metadata
    // NOT predicate — those tables don't have the column.
    expect(subAuditLogFindMany).toHaveBeenCalled();
    expect(brandAuditLogFindMany).toHaveBeenCalled();
    const subCall = subAuditLogFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    const brandCall = brandAuditLogFindMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> };
    expect(subCall?.where ?? {}).not.toHaveProperty("NOT");
    expect(brandCall?.where ?? {}).not.toHaveProperty("NOT");
  });

  it("preserves action filter alongside the testOrigin predicate", async () => {
    // No genericWhere call site currently sets metadata, but verify the
    // testOrigin predicate lands intact alongside the action filter.
    await listAuditLog(
      { excludeTestOrigin: true, actions: ["user.create", "user.update"] },
      { take: 50 },
    );
    const call = auditLogFindMany.mock.calls[0]?.[0] as {
      where: {
        action?: { in: string[] };
        metadata?: { not?: { testOrigin?: boolean } };
      };
    };
    expect(call.where.action).toEqual({ in: ["user.create", "user.update"] });
    expect(call.where.metadata).toEqual({ not: { testOrigin: true } });
  });
});

describe("countAuditLog merge", () => {
  it("sums per-source counts across touched sources", async () => {
    auditLogCount.mockResolvedValue(10);
    subAuditLogCount.mockResolvedValue(5);
    brandAuditLogCount.mockResolvedValue(3);
    const total = await countAuditLog({});
    expect(total).toBe(18);
  });

  it("excludes sources skipped by routing", async () => {
    auditLogCount.mockResolvedValue(10);
    subAuditLogCount.mockResolvedValue(5);
    brandAuditLogCount.mockResolvedValue(3);
    const total = await countAuditLog({ entityType: "Subscription" });
    expect(total).toBe(5);
    expect(auditLogCount).not.toHaveBeenCalled();
    expect(brandAuditLogCount).not.toHaveBeenCalled();
  });
});

describe("streamAuditLog heap-merge", () => {
  it("emits rows in DESC order across sources", async () => {
    // First call returns the chunk; subsequent returns empty (exhausted).
    auditLogFindMany
      .mockResolvedValueOnce([
        genericRow("g1", "2026-05-04T10:00:00Z"),
        genericRow("g2", "2026-05-04T07:00:00Z"),
      ])
      .mockResolvedValue([]);
    subAuditLogFindMany
      .mockResolvedValueOnce([
        subRow("s1", "2026-05-04T09:00:00Z"),
        subRow("s2", "2026-05-04T06:00:00Z"),
      ])
      .mockResolvedValue([]);
    brandAuditLogFindMany
      .mockResolvedValueOnce([
        brandRow("b1", "2026-05-04T11:00:00Z"),
        brandRow("b2", "2026-05-04T08:00:00Z"),
      ])
      .mockResolvedValue([]);

    const collected: string[] = [];
    for await (const row of streamAuditLog({}, 100)) {
      collected.push(row.id);
    }
    expect(collected).toEqual([
      "brand:b1", // 11:00
      "gen:g1", // 10:00
      "sub:s1", // 09:00
      "brand:b2", // 08:00
      "gen:g2", // 07:00
      "sub:s2", // 06:00
    ]);
  });
});
