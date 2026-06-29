import { beforeEach, describe, expect, it, vi } from "vitest";

const ensureProvisioned = vi.hoisted(() => vi.fn(async () => undefined));
const resolveEnterpriseId = vi.hoisted(() => vi.fn(async () => "ent-1" as string | null));
const ensureAdvisorDefaults = vi.hoisted(() => vi.fn(async () => undefined));
const prismaSpies = vi.hoisted(() => ({
  pillar: { findMany: vi.fn() },
  advisorPillarOverride: { findMany: vi.fn() },
  enterprisePillarOverride: { findMany: vi.fn() },
}));

vi.mock("@/lib/enterprise/provision-team-member-content", () => ({
  ensureEnterpriseTeamMemberProvisioned: ensureProvisioned,
  resolveEnterpriseIdForAdvisorProfile: resolveEnterpriseId,
}));
vi.mock("@/lib/methodology/snapshot", () => ({
  ensureAdvisorDefaultsCloned: ensureAdvisorDefaults,
}));
vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import { loadAdvisorMethodologyPillars } from "./methodology-queries";

describe("loadAdvisorMethodologyPillars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveEnterpriseId.mockResolvedValue("ent-1");
    prismaSpies.pillar.findMany.mockResolvedValue([
      {
        id: "pillar-gov",
        slug: "governance",
        canonicalName: "Governance",
        description: null,
        defaultOrder: 1,
      },
      {
        id: "pillar-cyber",
        slug: "cyber",
        canonicalName: "Cyber",
        description: null,
        defaultOrder: 2,
      },
    ]);
    prismaSpies.advisorPillarOverride.findMany.mockResolvedValue([]);
    prismaSpies.enterprisePillarOverride.findMany.mockResolvedValue([
      { pillarId: "pillar-gov", isActive: true, displayName: null, weight: 10, threshold: null, emphasisMultiplier: 1.5, displayOrder: 1 },
      { pillarId: "pillar-cyber", isActive: false, displayName: null, weight: 10, threshold: null, emphasisMultiplier: 1.5, displayOrder: 2 },
    ]);
  });

  it("defaults inactive pillars from enterprise overrides for team members", async () => {
    const pillars = await loadAdvisorMethodologyPillars("profile-1");

    expect(ensureProvisioned).toHaveBeenCalledWith("profile-1");
    expect(pillars.find((p) => p.slug === "governance")?.isActive).toBe(true);
    expect(pillars.find((p) => p.slug === "cyber")?.isActive).toBe(false);
  });

  it("prefers enterprise isActive for linked advisor overrides", async () => {
    prismaSpies.advisorPillarOverride.findMany.mockResolvedValue([
      {
        pillarId: "pillar-cyber",
        enterpriseSourceId: "ent-override-cyber",
        isActive: true,
        displayName: null,
        weight: 10,
        threshold: null,
        emphasisMultiplier: 1.5,
        displayOrder: 2,
        version: 1,
      },
    ]);
    prismaSpies.enterprisePillarOverride.findMany.mockResolvedValue([
      { id: "ent-override-gov", pillarId: "pillar-gov", isActive: true, displayName: null, weight: 10, threshold: null, emphasisMultiplier: 1.5, displayOrder: 1 },
      { id: "ent-override-cyber", pillarId: "pillar-cyber", isActive: false, displayName: null, weight: 10, threshold: null, emphasisMultiplier: 1.5, displayOrder: 2 },
    ]);

    const pillars = await loadAdvisorMethodologyPillars("profile-1");

    expect(pillars.find((p) => p.slug === "cyber")?.isActive).toBe(false);
  });
});
