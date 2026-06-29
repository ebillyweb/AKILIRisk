import { beforeEach, describe, expect, it, vi } from "vitest";

const cloneEnterpriseDefaults = vi.hoisted(() => vi.fn(async () => true));
const syncRulesToAdvisor = vi.hoisted(() => vi.fn(async () => ({ added: 2, deactivated: 0 })));
const syncMethodologyToAdvisor = vi.hoisted(() => vi.fn(async () => true));
const cloneAdvisorDefaults = vi.hoisted(() => vi.fn(async () => true));
const prismaSpies = vi.hoisted(() => ({
  advisorRecommendationRule: { count: vi.fn() },
  advisorPillarOverride: { count: vi.fn() },
  enterprisePillarOverride: { count: vi.fn() },
  advisorProfile: { findUnique: vi.fn() },
}));

vi.mock("@/lib/methodology/clone-enterprise-defaults", () => ({
  cloneEnterpriseDefaultsIfNeeded: cloneEnterpriseDefaults,
  syncEnterpriseRulesToAdvisor: syncRulesToAdvisor,
}));
vi.mock("@/lib/methodology/clone-enterprise-methodology", () => ({
  syncEnterpriseMethodologyToAdvisor: syncMethodologyToAdvisor,
}));
vi.mock("@/lib/methodology/clone-advisor-defaults", () => ({
  cloneAdvisorDefaultsIfNeeded: cloneAdvisorDefaults,
}));
vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import {
  ensureEnterpriseTeamMemberProvisioned,
  provisionEnterpriseTeamMemberContent,
} from "./provision-team-member-content";

describe("provisionEnterpriseTeamMemberContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaSpies.advisorRecommendationRule.count.mockResolvedValue(2);
  });

  it("seeds firm rules and methodology for a joining team member", async () => {
    await provisionEnterpriseTeamMemberContent("ent-1", "profile-1");

    expect(cloneEnterpriseDefaults).toHaveBeenCalledWith("ent-1");
    expect(syncRulesToAdvisor).toHaveBeenCalledWith("ent-1", "profile-1");
    expect(syncMethodologyToAdvisor).toHaveBeenCalledWith("ent-1", "profile-1");
    expect(cloneAdvisorDefaults).not.toHaveBeenCalled();
  });

  it("falls back to advisor defaults when no active rules were copied", async () => {
    prismaSpies.advisorRecommendationRule.count.mockResolvedValue(0);

    await provisionEnterpriseTeamMemberContent("ent-1", "profile-1");

    expect(cloneAdvisorDefaults).toHaveBeenCalledWith("profile-1");
  });
});

describe("ensureEnterpriseTeamMemberProvisioned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      enterpriseId: "ent-1",
      user: { enterpriseMembership: null },
    });
    prismaSpies.advisorRecommendationRule.count.mockResolvedValue(2);
    prismaSpies.enterprisePillarOverride.count.mockResolvedValue(3);
    prismaSpies.advisorPillarOverride.count.mockResolvedValue(3);
  });

  it("skips when firm rules and pillar overrides are already linked", async () => {
    await ensureEnterpriseTeamMemberProvisioned("profile-1");

    expect(cloneEnterpriseDefaults).not.toHaveBeenCalled();
  });

  it("re-provisions when enterprise pillar overrides are not linked on the member", async () => {
    prismaSpies.advisorPillarOverride.count.mockResolvedValue(1);

    await ensureEnterpriseTeamMemberProvisioned("profile-1");

    expect(cloneEnterpriseDefaults).toHaveBeenCalledWith("ent-1");
    expect(syncMethodologyToAdvisor).toHaveBeenCalledWith("ent-1", "profile-1");
  });

  it("provisions when the member has no active recommendation rules", async () => {
    prismaSpies.advisorRecommendationRule.count.mockResolvedValue(0);

    await ensureEnterpriseTeamMemberProvisioned("profile-1");

    expect(cloneEnterpriseDefaults).toHaveBeenCalledWith("ent-1");
  });
});
