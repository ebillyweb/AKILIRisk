import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorProfile: { findUnique: vi.fn(), update: vi.fn() },
  pillar: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

const enterpriseCloneSpies = vi.hoisted(() => ({
  cloneAllEnterpriseMethodologyToAdvisorInTx: vi.fn(async () => undefined),
  syncEnterpriseMethodologyToAdvisorInTx: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/methodology/clone-enterprise-methodology", () => enterpriseCloneSpies);

import { cloneAdvisorDefaultsIfNeeded } from "./clone-advisor-defaults";

const ADVISOR_PROFILE_ID = "adv-profile-1";
const ENTERPRISE_ID = "ent-1";

const PILLARS = [
  { id: "pillar-gov", slug: "governance", defaultOrder: 1, catalogVersion: 1 },
];

function mockTransaction() {
  prismaSpies.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      advisorProfile: {
        findUnique: vi.fn().mockResolvedValue({ enterpriseId: ENTERPRISE_ID }),
      },
      advisorPillarOverride: {
        count: vi.fn(),
        upsert: vi.fn(),
      },
      advisorPillarQuestion: { count: vi.fn().mockResolvedValue(0) },
      advisorIntakeQuestion: { count: vi.fn().mockResolvedValue(0) },
      advisorPillarNarrative: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      advisorRecommendationRule: { count: vi.fn().mockResolvedValue(0) },
      enterpriseRecommendationRule: { findMany: vi.fn().mockResolvedValue([]) },
      advisorRecommendationRuleCreate: vi.fn(),
    };
    await fn(tx);
    return tx;
  });
}

describe("cloneAdvisorDefaultsIfNeeded — enterprise branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      starterContentClonedAt: null,
    });
    prismaSpies.pillar.findMany.mockResolvedValue(PILLARS);
    prismaSpies.advisorProfile.update.mockResolvedValue({});
    mockTransaction();
  });

  it("clones firm methodology when the advisor belongs to an enterprise and has no overrides", async () => {
    prismaSpies.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        advisorProfile: {
          findUnique: vi.fn().mockResolvedValue({ enterpriseId: ENTERPRISE_ID }),
        },
        advisorPillarOverride: { count: vi.fn().mockResolvedValue(0), upsert: vi.fn() },
        advisorPillarQuestion: { count: vi.fn().mockResolvedValue(0) },
        advisorIntakeQuestion: { count: vi.fn().mockResolvedValue(0) },
        advisorPillarNarrative: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn(),
        },
        advisorRecommendationRule: { count: vi.fn().mockResolvedValue(0) },
        enterpriseRecommendationRule: { findMany: vi.fn().mockResolvedValue([]) },
        advisorProfileUpdate: vi.fn(),
      };
      Object.assign(tx, {
        advisorProfile: {
          ...tx.advisorProfile,
          update: vi.fn(),
        },
      });
      await fn({
        ...tx,
        advisorProfile: {
          findUnique: tx.advisorProfile.findUnique,
          update: vi.fn(),
        },
        enterpriseRecommendationRule: { findMany: vi.fn().mockResolvedValue([]) },
        advisorRecommendationRule: {
          count: tx.advisorRecommendationRule.count,
          create: vi.fn(),
        },
      });
    });

    const cloned = await cloneAdvisorDefaultsIfNeeded(ADVISOR_PROFILE_ID);

    expect(cloned).toBe(true);
    expect(enterpriseCloneSpies.cloneAllEnterpriseMethodologyToAdvisorInTx).toHaveBeenCalledWith(
      expect.anything(),
      ADVISOR_PROFILE_ID,
      ENTERPRISE_ID,
    );
    expect(enterpriseCloneSpies.syncEnterpriseMethodologyToAdvisorInTx).not.toHaveBeenCalled();
  });

  it("syncs firm methodology on force when overrides already exist", async () => {
    prismaSpies.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        advisorProfile: {
          findUnique: vi.fn().mockResolvedValue({ enterpriseId: ENTERPRISE_ID }),
          update: vi.fn(),
        },
        advisorPillarOverride: { count: vi.fn().mockResolvedValue(3), upsert: vi.fn() },
        advisorPillarQuestion: { count: vi.fn().mockResolvedValue(1) },
        advisorIntakeQuestion: { count: vi.fn().mockResolvedValue(1) },
        advisorPillarNarrative: {
          findUnique: vi.fn().mockResolvedValue({ id: "n-1" }),
          upsert: vi.fn(),
        },
        advisorRecommendationRule: {
          count: vi.fn().mockResolvedValue(1),
          findMany: vi.fn().mockResolvedValue([]),
        },
        enterpriseRecommendationRule: { findMany: vi.fn().mockResolvedValue([]) },
      });
    });

    await cloneAdvisorDefaultsIfNeeded(ADVISOR_PROFILE_ID, { force: true });

    expect(enterpriseCloneSpies.syncEnterpriseMethodologyToAdvisorInTx).toHaveBeenCalledWith(
      expect.anything(),
      ENTERPRISE_ID,
      ADVISOR_PROFILE_ID,
    );
    expect(enterpriseCloneSpies.cloneAllEnterpriseMethodologyToAdvisorInTx).not.toHaveBeenCalled();
  });

  it("seeds platform pillar overrides for solo advisors without an enterprise", async () => {
    const upsert = vi.fn();
    prismaSpies.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        advisorProfile: {
          findUnique: vi.fn().mockResolvedValue({ enterpriseId: null }),
          update: vi.fn(),
        },
        advisorPillarOverride: { count: vi.fn(), upsert },
        advisorPillarQuestion: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
        advisorIntakeQuestion: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
        advisorPillarNarrative: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn(),
        },
        advisorRecommendationRule: {
          count: vi.fn().mockResolvedValue(0),
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
        },
        pillarQuestion: { findMany: vi.fn().mockResolvedValue([]) },
        intakeQuestion: { findMany: vi.fn().mockResolvedValue([]) },
        recommendationRule: { findMany: vi.fn().mockResolvedValue([]) },
        enterpriseMembership: { findFirst: vi.fn().mockResolvedValue(null) },
      });
    });

    await cloneAdvisorDefaultsIfNeeded(ADVISOR_PROFILE_ID);

    expect(upsert).toHaveBeenCalled();
    expect(enterpriseCloneSpies.cloneAllEnterpriseMethodologyToAdvisorInTx).not.toHaveBeenCalled();
  });

  it("skips when starter content was already cloned and force is not set", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      starterContentClonedAt: new Date("2026-01-01"),
    });

    const cloned = await cloneAdvisorDefaultsIfNeeded(ADVISOR_PROFILE_ID);

    expect(cloned).toBe(false);
    expect(prismaSpies.$transaction).not.toHaveBeenCalled();
  });
});
