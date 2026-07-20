import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression for the "swallow DB errors into redirect('/signin')" anti-pattern.
 * The data load (loadEnterpriseMethodologyPillars) must sit OUTSIDE the auth
 * try/catch so a transient DB error surfaces as a real error (500 / error
 * boundary) instead of bouncing an authenticated enterprise manager to sign-in.
 */

const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    // Mirror next/navigation: redirect() throws to halt rendering.
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
);
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
);
const requireAdvisorRole = vi.hoisted(() => vi.fn());
const requireEnterpriseTeamManager = vi.hoisted(() => vi.fn());
const loadEnterpriseMethodologyPillars = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({ default: () => null }));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/advisor/auth", () => ({ requireAdvisorRole }));
vi.mock("@/lib/enterprise/team-access", () => ({ requireEnterpriseTeamManager }));
vi.mock("@/lib/methodology/enterprise-methodology-queries", () => ({
  loadEnterpriseMethodologyPillars,
}));
vi.mock("@/lib/admin/recommendation-queries", () => ({
  listQuestionsForRulePicker: vi.fn(async () => []),
}));
vi.mock("@/lib/admin/recommendation-rule-ui", () => ({
  serviceIdFromRulePayload: vi.fn(() => null),
}));
vi.mock("@/lib/assessment/pillar-registry", () => ({
  normalizePillarSlug: (s: string) => s,
}));
vi.mock("@/lib/methodology/enterprise-recommendation-queries", () => ({
  loadEnterpriseRecommendationRules: vi.fn(async () => []),
}));
vi.mock("@/lib/methodology/methodology-queries", () => ({
  loadActiveServiceRecommendations: vi.fn(async () => []),
  methodologyPillarDisplayName: vi.fn(() => "Governance"),
}));
vi.mock("@/components/ui/button", () => ({ Button: () => null }));
vi.mock("@/components/ui/card", () => ({ Card: () => null, CardContent: () => null }));
vi.mock("@/components/advisor/enterprise/EnterpriseRecommendationRulesEditor", () => ({
  EnterpriseRecommendationRulesEditor: () => null,
}));
vi.mock("@/components/advisor/methodology/MethodologyPillarTabs", () => ({
  MethodologyPillarTabs: () => null,
}));
vi.mock("@/components/product-tour/ConfigurationPageHeader", () => ({
  ConfigurationPageHeader: () => null,
}));

import EnterpriseRecommendationsPage from "./page";

describe("EnterpriseRecommendationsPage — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdvisorRole.mockResolvedValue({ userId: "u1" });
    requireEnterpriseTeamManager.mockResolvedValue({
      enterpriseName: "Belvedere Group",
      enterpriseId: "ent-1",
    });
  });

  it("propagates a loader DB error instead of redirecting to /signin", async () => {
    loadEnterpriseMethodologyPillars.mockRejectedValue(new Error("db connection lost"));

    await expect(
      EnterpriseRecommendationsPage({
        params: Promise.resolve({ slug: "governance" }),
      }),
    ).rejects.toThrow("db connection lost");

    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("redirects to /signin when the auth check fails", async () => {
    requireEnterpriseTeamManager.mockRejectedValue(new Error("Not authenticated"));

    await expect(
      EnterpriseRecommendationsPage({
        params: Promise.resolve({ slug: "governance" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/signin");

    expect(redirect).toHaveBeenCalledWith("/signin");
    expect(loadEnterpriseMethodologyPillars).not.toHaveBeenCalled();
  });
});
