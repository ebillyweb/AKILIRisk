import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  $transaction: vi.fn(),
  pillar: { findMany: vi.fn(), findUnique: vi.fn() },
  enterprisePillarOverride: { findMany: vi.fn() },
  enterprisePillarQuestion: { findMany: vi.fn() },
  enterpriseIntakeQuestion: { findMany: vi.fn() },
  enterprisePillarNarrative: { findUnique: vi.fn() },
}));

const ensurePlatformMethodology = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/methodology/clone-enterprise-methodology", () => ({
  ensureEnterprisePlatformMethodologyInTx: ensurePlatformMethodology,
}));
vi.mock("@/lib/methodology/platform-pillars", () => ({
  loadPlatformPillars: vi.fn(async () => [
    {
      id: "starter-gov",
      slug: "governance",
      name: "Governance",
      summary: "Starter summary",
      defaultOrder: 1,
    },
  ]),
}));

import {
  loadEnterpriseAssessmentQuestions,
  loadEnterpriseIntakeQuestions,
  loadEnterpriseMethodologyPillars,
  loadEnterprisePillarNarrative,
} from "./enterprise-methodology-queries";

const ENTERPRISE_ID = "ent-1";

describe("enterprise methodology queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaSpies.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({});
    });
  });

  it("ensures platform methodology is cloned before loading firm pillars", async () => {
    prismaSpies.pillar.findMany.mockResolvedValue([
      {
        id: "pillar-gov",
        slug: "governance",
        canonicalName: "Governance",
        description: "Governance pillar",
        defaultOrder: 1,
      },
    ]);
    prismaSpies.enterprisePillarOverride.findMany.mockResolvedValue([
      {
        pillarId: "pillar-gov",
        isActive: true,
        displayName: "Firm governance",
        weight: 12,
        threshold: { low: 40 },
        emphasisMultiplier: 1.8,
        displayOrder: 2,
        version: 3,
      },
    ]);

    const rows = await loadEnterpriseMethodologyPillars(ENTERPRISE_ID);

    expect(ensurePlatformMethodology).toHaveBeenCalledWith({}, ENTERPRISE_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      pillarId: "pillar-gov",
      slug: "governance",
      displayName: "Firm governance",
      weight: 12,
      version: 3,
    });
  });

  it("falls back to platform starter pillars when no DB pillars exist", async () => {
    prismaSpies.pillar.findMany.mockResolvedValue([]);
    prismaSpies.enterprisePillarOverride.findMany.mockResolvedValue([]);

    const rows = await loadEnterpriseMethodologyPillars(ENTERPRISE_ID);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      pillarId: "starter-gov",
      slug: "governance",
      canonicalName: "Governance",
      isActive: true,
    });
  });

  it("loads assessment questions after ensuring firm methodology exists", async () => {
    prismaSpies.pillar.findUnique.mockResolvedValue({ id: "pillar-gov", slug: "governance" });
    prismaSpies.enterprisePillarQuestion.findMany.mockResolvedValue([
      { id: "ent-q-1", questionText: "Firm question" },
    ]);

    const rows = await loadEnterpriseAssessmentQuestions(ENTERPRISE_ID, "governance");

    expect(ensurePlatformMethodology).toHaveBeenCalled();
    expect(prismaSpies.enterprisePillarQuestion.findMany).toHaveBeenCalledWith({
      where: { enterpriseId: ENTERPRISE_ID, pillarId: "pillar-gov" },
      orderBy: { displayOrder: "asc" },
    });
    expect(rows).toHaveLength(1);
  });

  it("loads intake questions and pillar narratives with ensure-clone guard", async () => {
    prismaSpies.enterpriseIntakeQuestion.findMany.mockResolvedValue([{ id: "ent-intake-1" }]);
    prismaSpies.pillar.findUnique.mockResolvedValue({ id: "pillar-gov", slug: "governance" });
    prismaSpies.enterprisePillarNarrative.findUnique.mockResolvedValue({ id: "ent-narr-1" });

    const intake = await loadEnterpriseIntakeQuestions(ENTERPRISE_ID);
    const narrative = await loadEnterprisePillarNarrative(ENTERPRISE_ID, "governance");

    expect(ensurePlatformMethodology).toHaveBeenCalledTimes(2);
    expect(intake).toHaveLength(1);
    expect(narrative).toEqual({ id: "ent-narr-1" });
  });
});
