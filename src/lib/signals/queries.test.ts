/**
 * BRD Epic 5.4 / US-29b–c–d — Signal-feed query tests.
 *
 * Coverage:
 *   • getAdvisorSignalFeed honours the 90-day window, default severity
 *     filter (Critical + Moderate), explicit severity overrides, the
 *     kinds filter ("risk" / "workflow"), unreadOnly, limit cap, and
 *     descending-by-createdAt ordering.
 *   • Risk signals for a client no longer actively assigned are dropped.
 *   • Workflow signals are mapped to the right drill-through href per
 *     notification type.
 *   • Summary counts (unread / critical / moderate / risk / workflow)
 *     are computed correctly across both streams.
 *   • markAdvisorSignalRead is ownership-scoped and idempotent on a
 *     row that is already read.
 *   • markAllAdvisorSignalsRead returns the affected-row count.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findAssignments = vi.fn();
const findManySignals = vi.fn();
const findManyNotifications = vi.fn();
const countSignals = vi.fn();
const countNotifications = vi.fn();
const updateManySignals = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findMany: (...args: unknown[]) => findAssignments(...args),
    },
    advisorSignal: {
      findMany: (...args: unknown[]) => findManySignals(...args),
      count: (...args: unknown[]) => countSignals(...args),
      updateMany: (...args: unknown[]) => updateManySignals(...args),
    },
    advisorNotification: {
      findMany: (...args: unknown[]) => findManyNotifications(...args),
      count: (...args: unknown[]) => countNotifications(...args),
    },
  },
}));

vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: (ct: string) => `decrypted:${ct}`,
}));

import {
  getAdvisorSignalFeed,
  markAdvisorSignalRead,
  markAllAdvisorSignalsRead,
} from "./queries";
import { SIGNAL_FEED_WINDOW_DAYS } from "./types";

beforeEach(() => {
  findAssignments.mockReset();
  findManySignals.mockReset();
  findManyNotifications.mockReset();
  countSignals.mockReset();
  countNotifications.mockReset();
  updateManySignals.mockReset();
  // Sensible defaults: empty assignments + empty rows + zero counts.
  findAssignments.mockResolvedValue([]);
  findManySignals.mockResolvedValue([]);
  findManyNotifications.mockResolvedValue([]);
  countSignals.mockResolvedValue(0);
  countNotifications.mockResolvedValue(0);
});

function client(name: string, id = "client-1") {
  return {
    id,
    emailCiphertext: `cipher-${id}`,
    name,
    firstName: null,
    lastName: null,
  };
}

describe("getAdvisorSignalFeed", () => {
  it("returns an empty feed and zero counts when nothing exists", async () => {
    const result = await getAdvisorSignalFeed("adv-1");
    expect(result.items).toEqual([]);
    expect(result.summary).toEqual({
      unreadCount: 0,
      criticalCount: 0,
      moderateCount: 0,
      workflowCount: 0,
      riskCount: 0,
    });
  });

  it("queries the last 90 days only", async () => {
    await getAdvisorSignalFeed("adv-1");
    const signalCall = findManySignals.mock.calls[0][0];
    const notifCall = findManyNotifications.mock.calls[0][0];
    const expected = new Date();
    expected.setDate(expected.getDate() - SIGNAL_FEED_WINDOW_DAYS);
    const sinceSignal = signalCall.where.createdAt.gte as Date;
    const sinceNotif = notifCall.where.createdAt.gte as Date;
    // Allow a few seconds of drift between the test computing `expected`
    // and the function computing its own `since`.
    expect(Math.abs(sinceSignal.getTime() - expected.getTime())).toBeLessThan(5_000);
    expect(Math.abs(sinceNotif.getTime() - expected.getTime())).toBeLessThan(5_000);
  });

  it("scopes risk signal queries to the requesting advisor profile", async () => {
    await getAdvisorSignalFeed("adv-tenant-a");
    expect(findManySignals.mock.calls[0][0].where.advisorId).toBe("adv-tenant-a");
    await getAdvisorSignalFeed("adv-tenant-b");
    expect(findManySignals.mock.calls[1][0].where.advisorId).toBe("adv-tenant-b");
  });

  it("does not return another advisor's risk rows when the DB is scoped per advisor", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-a" }]);
    findManySignals.mockResolvedValue([
      {
        id: "sig-a",
        advisorId: "adv-tenant-a",
        clientId: "client-a",
        source: "INTERNAL_ASSESSMENT",
        type: "PILLAR_CRITICAL",
        severity: "critical",
        title: "Tenant A signal",
        message: "...",
        payload: { assessmentId: "asmt-1", href: "/advisor/intelligence/client-a" },
        readAt: null,
        createdAt: new Date("2026-05-20T12:00:00Z"),
        client: client("Client A", "client-a"),
      },
    ]);

    const result = await getAdvisorSignalFeed("adv-tenant-a");
    expect(result.items.map((i) => i.id)).toEqual(["sig-a"]);
    expect(findManySignals.mock.calls[0][0].where.advisorId).toBe("adv-tenant-a");
  });

  it("applies the default Critical+Moderate severity filter to risk signals", async () => {
    await getAdvisorSignalFeed("adv-1");
    const call = findManySignals.mock.calls[0][0];
    expect(call.where.severity.in).toEqual(["critical", "moderate"]);
  });

  it("honours a caller-provided severity override", async () => {
    await getAdvisorSignalFeed("adv-1", { severity: ["critical"] });
    expect(findManySignals.mock.calls[0][0].where.severity.in).toEqual(["critical"]);
  });

  it("skips the risk-signal query when kinds excludes 'risk'", async () => {
    await getAdvisorSignalFeed("adv-1", { kinds: ["workflow"] });
    expect(findManySignals).not.toHaveBeenCalled();
    expect(findManyNotifications).toHaveBeenCalled();
  });

  it("skips the workflow query when kinds excludes 'workflow'", async () => {
    await getAdvisorSignalFeed("adv-1", { kinds: ["risk"] });
    expect(findManyNotifications).not.toHaveBeenCalled();
    expect(findManySignals).toHaveBeenCalled();
  });

  it("forwards unreadOnly to both underlying queries", async () => {
    await getAdvisorSignalFeed("adv-1", { unreadOnly: true });
    expect(findManySignals.mock.calls[0][0].where.readAt).toBeNull();
    expect(findManyNotifications.mock.calls[0][0].where.read).toBe(false);
  });

  it("drops a risk signal whose client is no longer actively assigned", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findManySignals.mockResolvedValue([
      {
        id: "sig-mine",
        advisorId: "adv-1",
        clientId: "client-1",
        source: "INTERNAL_ASSESSMENT",
        type: "PILLAR_CRITICAL",
        severity: "critical",
        title: "Critical risk — Cyber",
        message: "...",
        payload: { assessmentId: "asmt-1", href: "/advisor/intelligence/client-1" },
        readAt: null,
        createdAt: new Date("2026-05-20T12:00:00Z"),
        client: client("Alex"),
      },
      {
        id: "sig-orphan",
        advisorId: "adv-1",
        clientId: "client-unassigned",
        source: "INTERNAL_ASSESSMENT",
        type: "PILLAR_CRITICAL",
        severity: "critical",
        title: "Critical risk — Cyber",
        message: "...",
        payload: { assessmentId: "asmt-9", href: "/x" },
        readAt: null,
        createdAt: new Date("2026-05-20T12:00:00Z"),
        client: client("Stranger", "client-unassigned"),
      },
    ]);

    const result = await getAdvisorSignalFeed("adv-1");
    const ids = result.items.map((i) => i.id);
    expect(ids).toContain("sig-mine");
    expect(ids).not.toContain("sig-orphan");
  });

  it("maps workflow notifications to drill-through hrefs by type", async () => {
    findManyNotifications.mockResolvedValue([
      {
        id: "n-stalled",
        type: "WORKFLOW_STALLED",
        title: "Stalled",
        message: "...",
        referenceId: "client-1",
        read: false,
        createdAt: new Date(),
      },
      {
        id: "n-intake",
        type: "NEW_INTAKE",
        title: "New intake",
        message: "...",
        referenceId: "intk-1",
        read: false,
        createdAt: new Date(),
      },
      {
        id: "n-intake-noref",
        type: "NEW_INTAKE",
        title: "New intake",
        message: "...",
        referenceId: null,
        read: false,
        createdAt: new Date(),
      },
    ]);

    const result = await getAdvisorSignalFeed("adv-1");
    const byId = Object.fromEntries(result.items.map((i) => [i.id, i] as const));
    expect((byId["n-stalled"] as { href: string }).href).toBe(
      "/advisor/pipeline?stalled=1"
    );
    expect((byId["n-intake"] as { href: string }).href).toBe(
      "/advisor/review/intk-1"
    );
    expect((byId["n-intake-noref"] as { href: string }).href).toBe(
      "/advisor/pipeline?awaitingReview=1"
    );
  });

  it("interleaves risk and workflow items in descending createdAt order", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findManySignals.mockResolvedValue([
      {
        id: "sig-1",
        advisorId: "adv-1",
        clientId: "client-1",
        source: "INTERNAL_ASSESSMENT",
        type: "PILLAR_CRITICAL",
        severity: "critical",
        title: "Critical",
        message: "...",
        payload: { assessmentId: "asmt-1", href: "/x" },
        readAt: null,
        createdAt: new Date("2026-05-22T12:00:00Z"),
        client: client("Alex"),
      },
    ]);
    findManyNotifications.mockResolvedValue([
      {
        id: "n-1",
        type: "WORKFLOW_STALLED",
        title: "Stalled",
        message: "...",
        referenceId: null,
        read: false,
        createdAt: new Date("2026-05-23T12:00:00Z"), // newer
      },
    ]);

    const result = await getAdvisorSignalFeed("adv-1");
    expect(result.items.map((i) => i.id)).toEqual(["n-1", "sig-1"]);
  });

  it("respects the limit on the merged feed", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findManySignals.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `sig-${i}`,
        advisorId: "adv-1",
        clientId: "client-1",
        source: "INTERNAL_ASSESSMENT",
        type: "PILLAR_CRITICAL",
        severity: "critical",
        title: "Critical",
        message: "...",
        payload: { assessmentId: "asmt-1", href: "/x" },
        readAt: null,
        createdAt: new Date(2026, 4, 10 + i),
        client: client("Alex"),
      }))
    );
    findManyNotifications.mockResolvedValue(
      Array.from({ length: 3 }, (_, i) => ({
        id: `n-${i}`,
        type: "WORKFLOW_STALLED",
        title: "Stalled",
        message: "...",
        referenceId: null,
        read: false,
        createdAt: new Date(2026, 4, 1 + i),
      }))
    );

    const result = await getAdvisorSignalFeed("adv-1", { limit: 2 });
    expect(result.items).toHaveLength(2);
  });

  it("computes summary counts across both streams", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findManySignals.mockResolvedValue([
      {
        id: "sig-crit",
        advisorId: "adv-1",
        clientId: "client-1",
        source: "INTERNAL_ASSESSMENT",
        type: "PILLAR_CRITICAL",
        severity: "critical",
        title: "Critical",
        message: "...",
        payload: { assessmentId: "asmt-1", href: "/x" },
        readAt: null,
        createdAt: new Date("2026-05-20T12:00:00Z"),
        client: client("Alex"),
      },
      {
        id: "sig-mod",
        advisorId: "adv-1",
        clientId: "client-1",
        source: "INTERNAL_ASSESSMENT",
        type: "PILLAR_MODERATE",
        severity: "moderate",
        title: "Elevated",
        message: "...",
        payload: { assessmentId: "asmt-1", href: "/x" },
        readAt: null,
        createdAt: new Date("2026-05-19T12:00:00Z"),
        client: client("Alex"),
      },
    ]);
    findManyNotifications.mockResolvedValue([
      {
        id: "n-stalled",
        type: "WORKFLOW_STALLED",
        title: "Stalled",
        message: "...",
        referenceId: null,
        read: false,
        createdAt: new Date("2026-05-21T12:00:00Z"),
      },
    ]);
    countSignals.mockResolvedValue(2);
    countNotifications.mockResolvedValue(1);

    const result = await getAdvisorSignalFeed("adv-1");
    expect(result.summary).toEqual({
      unreadCount: 3,
      criticalCount: 1,
      moderateCount: 2, // sig-mod is moderate; WORKFLOW_STALLED maps to moderate
      workflowCount: 1,
      riskCount: 2,
    });
  });

  it("filters out workflow signals whose severity falls below the requested filter", async () => {
    findManyNotifications.mockResolvedValue([
      {
        id: "n-milestone",
        type: "MILESTONE_COMPLETE", // → low severity
        title: "Milestone",
        message: "...",
        referenceId: null,
        read: false,
        createdAt: new Date(),
      },
    ]);
    const result = await getAdvisorSignalFeed("adv-1");
    expect(result.items).toHaveLength(0);
  });
});

describe("markAdvisorSignalRead", () => {
  it("returns true when the row was updated", async () => {
    updateManySignals.mockResolvedValue({ count: 1 });
    const ok = await markAdvisorSignalRead("sig-1", "adv-1");
    expect(ok).toBe(true);
  });

  it("returns false when no row was updated (wrong advisor or unknown id)", async () => {
    updateManySignals.mockResolvedValue({ count: 0 });
    const ok = await markAdvisorSignalRead("sig-1", "adv-1");
    expect(ok).toBe(false);
  });

  it("scopes the update to the calling advisor and to unread rows", async () => {
    updateManySignals.mockResolvedValue({ count: 1 });
    await markAdvisorSignalRead("sig-1", "adv-1");
    const call = updateManySignals.mock.calls[0][0];
    expect(call.where).toMatchObject({
      id: "sig-1",
      advisorId: "adv-1",
      readAt: null,
    });
  });
});

describe("markAllAdvisorSignalsRead", () => {
  it("returns the affected-row count", async () => {
    updateManySignals.mockResolvedValue({ count: 5 });
    const n = await markAllAdvisorSignalsRead("adv-1");
    expect(n).toBe(5);
  });

  it("scopes the update to the calling advisor and to unread rows", async () => {
    updateManySignals.mockResolvedValue({ count: 0 });
    await markAllAdvisorSignalsRead("adv-1");
    const call = updateManySignals.mock.calls[0][0];
    expect(call.where).toMatchObject({ advisorId: "adv-1", readAt: null });
  });
});
