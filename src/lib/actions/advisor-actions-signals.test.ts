/**
 * BRD Epic 5.4 / US-29b–c — Advisor signal server-action tests.
 *
 * Scope: the three signal-related actions exported from
 * `advisor-actions.ts` — getAdvisorSignalsAction, markSignalReadAction,
 * and markAllSignalsReadAction. The action layer is thin: each enforces
 * the advisor-role guard, resolves the AdvisorProfile, calls the
 * underlying signal query (covered separately in queries.test.ts), and
 * revalidates the appropriate cache paths.
 *
 * Tested behaviour:
 *   • Auth + role gate enforced for every action.
 *   • getAdvisorSignalsAction passes the caller's filter to the
 *     underlying query and returns its result on success.
 *   • markSignalReadAction validates the cuid shape, returns
 *     "Signal not found" when the row is not owned, and revalidates
 *     the signals + advisor pages on success.
 *   • markAllSignalsReadAction calls both the risk-signal and the
 *     workflow-notification bulk-mark helpers (BRD US-29c) and
 *     revalidates the three relevant pages.
 *   • A thrown error from the underlying helper is surfaced as a
 *     structured { success: false, error } result.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdvisorRoleMock = vi.fn();
const getAdvisorProfileOrThrowMock = vi.fn();
vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: () => requireAdvisorRoleMock(),
  getAdvisorProfileOrThrow: (userId: string) => getAdvisorProfileOrThrowMock(userId),
  advisorHubActionErrorMessage: (err: unknown) => err instanceof Error ? err.message : String(err),
}));

const getAdvisorSignalFeed = vi.fn();
const markAdvisorSignalRead = vi.fn();
const markAllAdvisorSignalsRead = vi.fn();
vi.mock("@/lib/signals/queries", () => ({
  getAdvisorSignalFeed: (...a: unknown[]) => getAdvisorSignalFeed(...a),
  markAdvisorSignalRead: (...a: unknown[]) => markAdvisorSignalRead(...a),
  markAllAdvisorSignalsRead: (...a: unknown[]) => markAllAdvisorSignalsRead(...a),
}));

const markAllNotificationsRead = vi.fn();
vi.mock("@/lib/data/advisor", () => ({
  // Only the function the signal actions actually call. The rest of the
  // advisor-actions module imports from this file too; vitest's hoisted
  // mock just needs to provide the names that get touched by the
  // call paths exercised in this file.
  markAllNotificationsRead: (...a: unknown[]) => markAllNotificationsRead(...a),
  getClientIntakeForReview: vi.fn(),
  createIntakeApproval: vi.fn(),
  updateIntakeApproval: vi.fn(),
  getAdvisorNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

import {
  getAdvisorSignalsAction,
  markSignalReadAction,
  markAllSignalsReadAction,
} from "./advisor-actions";

beforeEach(() => {
  requireAdvisorRoleMock.mockReset();
  getAdvisorProfileOrThrowMock.mockReset();
  getAdvisorSignalFeed.mockReset();
  markAdvisorSignalRead.mockReset();
  markAllAdvisorSignalsRead.mockReset();
  markAllNotificationsRead.mockReset();
  revalidatePath.mockReset();

  // Sensible advisor-session defaults.
  requireAdvisorRoleMock.mockResolvedValue({
    userId: "advisor-1",
    role: "ADVISOR",
    email: "advisor@x.com",
  });
  getAdvisorProfileOrThrowMock.mockResolvedValue({ id: "adv-prof-1" });
});

describe("getAdvisorSignalsAction", () => {
  it("returns the feed when the advisor is authorized", async () => {
    const payload = {
      items: [],
      summary: {
        unreadCount: 0,
        criticalCount: 0,
        moderateCount: 0,
        workflowCount: 0,
        riskCount: 0,
      },
    };
    getAdvisorSignalFeed.mockResolvedValue(payload);
    const r = await getAdvisorSignalsAction();
    expect(r).toEqual({ success: true, data: payload });
    expect(getAdvisorSignalFeed).toHaveBeenCalledWith("adv-prof-1", undefined);
  });

  it("forwards the caller's filters to the underlying query", async () => {
    getAdvisorSignalFeed.mockResolvedValue({
      items: [],
      summary: {
        unreadCount: 0,
        criticalCount: 0,
        moderateCount: 0,
        workflowCount: 0,
        riskCount: 0,
      },
    });
    const filters = {
      unreadOnly: true,
      severity: ["critical" as const],
    };
    await getAdvisorSignalsAction(filters);
    expect(getAdvisorSignalFeed).toHaveBeenCalledWith("adv-prof-1", filters);
  });

  it("returns a structured failure when the advisor guard rejects", async () => {
    requireAdvisorRoleMock.mockRejectedValue(new Error("not an advisor"));
    const r = await getAdvisorSignalsAction();
    expect(r).toEqual({ success: false, error: "not an advisor" });
    expect(getAdvisorSignalFeed).not.toHaveBeenCalled();
  });
});

describe("markSignalReadAction", () => {
  const validCuid = "cjld2cjxh0000qzrmn831i7rn"; // 25-char cuid format

  it("rejects an invalid signal id without touching the query layer", async () => {
    const r = await markSignalReadAction("not-a-cuid");
    expect(r).toEqual({ success: false, error: "Invalid signal ID" });
    expect(markAdvisorSignalRead).not.toHaveBeenCalled();
  });

  it("returns 'Signal not found' when the underlying update affects no rows", async () => {
    markAdvisorSignalRead.mockResolvedValue(false);
    const r = await markSignalReadAction(validCuid);
    expect(r).toEqual({ success: false, error: "Signal not found" });
  });

  it("revalidates /advisor/signals and /advisor on a successful mark-read", async () => {
    markAdvisorSignalRead.mockResolvedValue(true);
    const r = await markSignalReadAction(validCuid);
    expect(r).toEqual({ success: true });
    expect(markAdvisorSignalRead).toHaveBeenCalledWith(validCuid, "adv-prof-1");
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(expect.arrayContaining(["/advisor/signals", "/advisor"]));
  });

  it("surfaces a thrown error as a structured failure", async () => {
    markAdvisorSignalRead.mockRejectedValue(new Error("db down"));
    const r = await markSignalReadAction(validCuid);
    expect(r).toEqual({ success: false, error: "db down" });
  });
});

describe("markAllSignalsReadAction", () => {
  it("marks both risk signals and workflow notifications as read in one call", async () => {
    markAllAdvisorSignalsRead.mockResolvedValue(7);
    markAllNotificationsRead.mockResolvedValue(undefined);
    const r = await markAllSignalsReadAction();
    expect(r).toEqual({ success: true });
    expect(markAllAdvisorSignalsRead).toHaveBeenCalledWith("adv-prof-1");
    expect(markAllNotificationsRead).toHaveBeenCalledWith("adv-prof-1");
  });

  it("revalidates /advisor/signals, /advisor/notifications, and /advisor", async () => {
    markAllAdvisorSignalsRead.mockResolvedValue(0);
    markAllNotificationsRead.mockResolvedValue(undefined);
    await markAllSignalsReadAction();
    const paths = revalidatePath.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/advisor/signals",
        "/advisor/notifications",
        "/advisor",
      ])
    );
  });

  it("returns a structured failure when the role guard rejects", async () => {
    requireAdvisorRoleMock.mockRejectedValue(new Error("not an advisor"));
    const r = await markAllSignalsReadAction();
    expect(r.success).toBe(false);
    expect(markAllAdvisorSignalsRead).not.toHaveBeenCalled();
  });
});
