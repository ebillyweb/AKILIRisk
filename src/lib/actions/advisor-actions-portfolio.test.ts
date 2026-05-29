/**
 * BRD Epic 5.4 / US-33c–d — Portfolio Recommendations + Reports action tests.
 *
 * Scope: the two portfolio actions exported from `advisor-actions.ts`:
 *   • getPortfolioRecommendationsAction
 *   • getPortfolioReportsAction
 *
 * Both follow the same shape: enforce the advisor-role guard, resolve
 * the AdvisorProfile, call the underlying portfolio query (covered in
 * the query test files), and surface either a structured success or a
 * structured failure. The tests verify the contract end-to-end while
 * mocking the auth + query layers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAdvisorRoleMock = vi.fn();
const getAdvisorProfileOrThrowMock = vi.fn();
vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: () => requireAdvisorRoleMock(),
  getAdvisorProfileOrThrow: (userId: string) =>
    getAdvisorProfileOrThrowMock(userId),
}));

const getPortfolioRecommendations = vi.fn();
vi.mock("@/lib/recommendations/queries", () => ({
  getPortfolioRecommendations: (...a: unknown[]) =>
    getPortfolioRecommendations(...a),
}));

const getPortfolioReports = vi.fn();
vi.mock("@/lib/reports/portfolio-queries", () => ({
  getPortfolioReports: (...a: unknown[]) => getPortfolioReports(...a),
}));

// advisor-actions.ts imports from a handful of unrelated modules at the
// top level; stub the ones that would otherwise drag in server-only deps.
vi.mock("@/lib/data/advisor", () => ({
  getClientIntakeForReview: vi.fn(),
  createIntakeApproval: vi.fn(),
  updateIntakeApproval: vi.fn(),
  getAdvisorNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  getPortfolioRecommendationsAction,
  getPortfolioReportsAction,
} from "./advisor-actions";

beforeEach(() => {
  requireAdvisorRoleMock.mockReset();
  getAdvisorProfileOrThrowMock.mockReset();
  getPortfolioRecommendations.mockReset();
  getPortfolioReports.mockReset();

  requireAdvisorRoleMock.mockResolvedValue({
    userId: "advisor-1",
    role: "ADVISOR",
    email: "advisor@x.com",
  });
  getAdvisorProfileOrThrowMock.mockResolvedValue({ id: "adv-prof-1" });
});

describe("getPortfolioRecommendationsAction", () => {
  const emptyPayload = {
    summary: {
      assignedClients: 0,
      clientsWithRecommendations: 0,
      totalRecommendations: 0,
      pendingCount: 0,
      actionNeededCount: 0,
    },
    groups: [],
  };

  it("returns the query payload on success and passes through the advisor profile id", async () => {
    getPortfolioRecommendations.mockResolvedValue(emptyPayload);
    const r = await getPortfolioRecommendationsAction();
    expect(r).toEqual({ success: true, data: emptyPayload });
    expect(getPortfolioRecommendations).toHaveBeenCalledWith(
      "adv-prof-1",
      undefined
    );
  });

  it("forwards the caller's filters verbatim", async () => {
    getPortfolioRecommendations.mockResolvedValue(emptyPayload);
    const filters = {
      status: "all" as const,
      actionNeededOnly: true,
      category: "cyber",
    };
    await getPortfolioRecommendationsAction(filters);
    expect(getPortfolioRecommendations).toHaveBeenCalledWith(
      "adv-prof-1",
      filters
    );
  });

  it("returns a structured failure when the advisor guard rejects", async () => {
    requireAdvisorRoleMock.mockRejectedValue(new Error("not an advisor"));
    const r = await getPortfolioRecommendationsAction();
    expect(r).toEqual({ success: false, error: "not an advisor" });
    expect(getPortfolioRecommendations).not.toHaveBeenCalled();
  });

  it("returns a structured failure when the underlying query throws", async () => {
    getPortfolioRecommendations.mockRejectedValue(new Error("db down"));
    const r = await getPortfolioRecommendationsAction();
    expect(r).toEqual({ success: false, error: "db down" });
  });

  it("falls back to a default error message when the thrown value is not an Error", async () => {
    getPortfolioRecommendations.mockRejectedValue("kaboom");
    const r = await getPortfolioRecommendationsAction();
    expect(r).toEqual({
      success: false,
      error: "Failed to load portfolio recommendations",
    });
  });
});

describe("getPortfolioReportsAction", () => {
  const emptyPayload = {
    summary: {
      assignedClients: 0,
      clientsWithReports: 0,
      totalReports: 0,
      draftCount: 0,
      publishedCount: 0,
      needsPublishCount: 0,
    },
    groups: [],
  };

  it("returns the query payload on success and passes through the advisor profile id", async () => {
    getPortfolioReports.mockResolvedValue(emptyPayload);
    const r = await getPortfolioReportsAction();
    expect(r).toEqual({ success: true, data: emptyPayload });
    expect(getPortfolioReports).toHaveBeenCalledWith("adv-prof-1", undefined);
  });

  it("forwards the caller's filters verbatim", async () => {
    getPortfolioReports.mockResolvedValue(emptyPayload);
    const filters = { status: "DRAFT" as const, needsPublishOnly: true };
    await getPortfolioReportsAction(filters);
    expect(getPortfolioReports).toHaveBeenCalledWith("adv-prof-1", filters);
  });

  it("returns a structured failure when the advisor guard rejects", async () => {
    requireAdvisorRoleMock.mockRejectedValue(new Error("not an advisor"));
    const r = await getPortfolioReportsAction();
    expect(r).toEqual({ success: false, error: "not an advisor" });
    expect(getPortfolioReports).not.toHaveBeenCalled();
  });

  it("returns a structured failure when the underlying query throws", async () => {
    getPortfolioReports.mockRejectedValue(new Error("db down"));
    const r = await getPortfolioReportsAction();
    expect(r).toEqual({ success: false, error: "db down" });
  });

  it("falls back to a default error message when the thrown value is not an Error", async () => {
    getPortfolioReports.mockRejectedValue("kaboom");
    const r = await getPortfolioReportsAction();
    expect(r).toEqual({
      success: false,
      error: "Failed to load portfolio reports",
    });
  });
});
