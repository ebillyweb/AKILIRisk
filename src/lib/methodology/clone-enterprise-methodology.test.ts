import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdvisorQuestionSource, type Prisma } from "@prisma/client";

import {
  enterpriseHasMethodologyContent,
  ensureEnterprisePlatformMethodologyInTx,
  syncEnterpriseMethodologyToAdvisorInTx,
  syncEnterpriseMethodologyToMembers,
  transferAdvisorMethodologyToEnterpriseInTx,
} from "./clone-enterprise-methodology";

const prismaSpies = vi.hoisted(() => ({
  enterpriseMembership: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

type MethodologyTx = Prisma.TransactionClient;

function countMock(value: number) {
  return vi.fn().mockResolvedValue(value);
}

function createMethodologyTx(
  partial: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {},
): MethodologyTx {
  const base = {
    enterprisePillarOverride: {
      count: countMock(0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "ent-override-1",
        ...data,
      })),
      findMany: vi.fn().mockResolvedValue([]),
    },
    enterprisePillarQuestion: {
      count: countMock(0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "ent-assess-1",
        ...data,
      })),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    enterpriseIntakeQuestion: {
      count: countMock(0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "ent-intake-1",
        ...data,
      })),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    enterprisePillarNarrative: {
      count: countMock(0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "ent-narrative-1",
        ...data,
      })),
      findMany: vi.fn().mockResolvedValue([]),
    },
    advisorPillarOverride: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    advisorPillarQuestion: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    advisorIntakeQuestion: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    advisorPillarNarrative: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      upsert: vi.fn().mockResolvedValue({}),
    },
    advisorProfile: {
      findUnique: vi.fn().mockResolvedValue({ enterpriseId: "ent-1" }),
    },
    pillar: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    pillarQuestion: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  for (const [table, methods] of Object.entries(partial)) {
    base[table as keyof typeof base] = {
      ...base[table as keyof typeof base],
      ...methods,
    } as (typeof base)[keyof typeof base];
  }

  return base as unknown as MethodologyTx;
}

describe("enterpriseHasMethodologyContent", () => {
  it("returns false when all enterprise methodology tables are empty", async () => {
    const tx = createMethodologyTx();
    await expect(enterpriseHasMethodologyContent(tx, "ent-1")).resolves.toBe(false);
  });

  it("returns true when any enterprise methodology table has rows", async () => {
    const tx = createMethodologyTx({
      enterprisePillarQuestion: { count: countMock(2) },
    });
    await expect(enterpriseHasMethodologyContent(tx, "ent-1")).resolves.toBe(true);
  });
});

describe("transferAdvisorMethodologyToEnterpriseInTx", () => {
  it("promotes advisor pillar overrides to enterprise and links the source row", async () => {
    const tx = createMethodologyTx({
      advisorPillarOverride: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "adv-override-1",
            pillarId: "pillar-gov",
            isActive: true,
            displayName: "Governance label",
            weight: 12,
            threshold: { lowMin: 1, mediumMin: 2, highMin: 3 },
            sectionWeights: null,
            emphasisMultiplier: 1.5,
            displayOrder: 1,
          },
        ]),
      },
    });

    const transferred = await transferAdvisorMethodologyToEnterpriseInTx(
      tx,
      "profile-owner",
      "ent-1",
    );

    expect(transferred).toBe(1);
    expect(tx.enterprisePillarOverride.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enterpriseId: "ent-1",
          pillarId: "pillar-gov",
          weight: 12,
          displayName: "Governance label",
        }),
      }),
    );
    expect(tx.advisorPillarOverride.update).toHaveBeenCalledWith({
      where: { id: "adv-override-1" },
      data: { enterpriseSourceId: "ent-override-1", version: { increment: 1 } },
    });
  });

  it("marks custom assessment questions as enterprise-sourced on the advisor profile", async () => {
    const tx = createMethodologyTx({
      advisorPillarQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "adv-q-1",
            pillarId: "pillar-gov",
            sourceKind: AdvisorQuestionSource.CUSTOM,
            platformSourceId: null,
            sectionCode: "CUSTOM",
            displayOrder: 0,
            questionNumber: null,
            questionText: "Custom governance question",
            answerType: "scored_0_3",
            scoreMap: { "0": 0, "1": 1, "2": 2, "3": 3 },
            whyThisMatters: null,
            recommendedActions: null,
            isVisible: true,
            isKeyRiskIndicator: false,
            relatedPillarIds: [],
          },
        ]),
      },
    });

    const transferred = await transferAdvisorMethodologyToEnterpriseInTx(
      tx,
      "profile-owner",
      "ent-1",
    );

    expect(transferred).toBe(1);
    expect(tx.enterprisePillarQuestion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceKind: AdvisorQuestionSource.CUSTOM,
          questionText: "Custom governance question",
        }),
      }),
    );
    expect(tx.advisorPillarQuestion.update).toHaveBeenCalledWith({
      where: { id: "adv-q-1" },
      data: {
        enterpriseSourceId: "ent-assess-1",
        sourceKind: AdvisorQuestionSource.ENTERPRISE,
        version: { increment: 1 },
      },
    });
  });

  it("merges new custom questions when enterprise methodology already exists", async () => {
    const tx = createMethodologyTx({
      enterprisePillarOverride: { count: countMock(1) },
      advisorPillarQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "adv-q-new",
            pillarId: "pillar-gov",
            sourceKind: AdvisorQuestionSource.CUSTOM,
            platformSourceId: null,
            sectionCode: "CUSTOM",
            displayOrder: 1,
            questionNumber: null,
            questionText: "Admin-only custom question",
            answerType: "scored_0_3",
            scoreMap: { "0": 0, "1": 1, "2": 2, "3": 3 },
            whyThisMatters: null,
            recommendedActions: null,
            isVisible: true,
            isKeyRiskIndicator: false,
            relatedPillarIds: [],
          },
        ]),
      },
      enterprisePillarQuestion: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          id: "ent-assess-new",
          ...data,
        })),
      },
    });

    const merged = await transferAdvisorMethodologyToEnterpriseInTx(
      tx,
      "profile-admin",
      "ent-1",
    );

    expect(merged).toBe(1);
    expect(tx.enterprisePillarQuestion.create).toHaveBeenCalled();
    expect(tx.advisorPillarQuestion.update).toHaveBeenCalledWith({
      where: { id: "adv-q-new" },
      data: {
        enterpriseSourceId: "ent-assess-new",
        sourceKind: AdvisorQuestionSource.ENTERPRISE,
        version: { increment: 1 },
      },
    });
  });

  it("links duplicate custom questions to the existing enterprise row instead of creating a copy", async () => {
    const tx = createMethodologyTx({
      enterprisePillarOverride: { count: countMock(1) },
      advisorPillarQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "adv-q-dup",
            pillarId: "pillar-gov",
            sourceKind: AdvisorQuestionSource.CUSTOM,
            platformSourceId: null,
            sectionCode: "CUSTOM",
            displayOrder: 0,
            questionNumber: null,
            questionText: "Existing firm question",
            answerType: "scored_0_3",
            scoreMap: { "0": 0 },
            whyThisMatters: null,
            recommendedActions: null,
            isVisible: true,
            isKeyRiskIndicator: false,
            relatedPillarIds: [],
          },
        ]),
      },
      enterprisePillarQuestion: {
        findFirst: vi.fn().mockResolvedValue({ id: "ent-assess-existing" }),
      },
    });

    const merged = await transferAdvisorMethodologyToEnterpriseInTx(
      tx,
      "profile-admin",
      "ent-1",
    );

    expect(merged).toBe(0);
    expect(tx.enterprisePillarQuestion.create).not.toHaveBeenCalled();
    expect(tx.advisorPillarQuestion.update).toHaveBeenCalledWith({
      where: { id: "adv-q-dup" },
      data: {
        enterpriseSourceId: "ent-assess-existing",
        sourceKind: AdvisorQuestionSource.ENTERPRISE,
        version: { increment: 1 },
      },
    });
  });
});

describe("ensureEnterprisePlatformMethodologyInTx", () => {
  it("returns false without seeding when enterprise methodology already exists", async () => {
    const tx = createMethodologyTx({
      enterpriseIntakeQuestion: { count: countMock(3) },
    });

    await expect(ensureEnterprisePlatformMethodologyInTx(tx, "ent-1")).resolves.toBe(false);
    expect(tx.pillar.findMany).not.toHaveBeenCalled();
  });

  it("seeds pillar overrides and narratives from platform defaults when empty", async () => {
    const tx = createMethodologyTx({
      pillar: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "pillar-gov",
            slug: "governance",
            defaultOrder: 1,
          },
        ]),
      },
    });

    await expect(ensureEnterprisePlatformMethodologyInTx(tx, "ent-1")).resolves.toBe(true);
    expect(tx.enterprisePillarOverride.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enterpriseId: "ent-1",
          pillarId: "pillar-gov",
          isActive: true,
        }),
      }),
    );
    expect(tx.enterprisePillarNarrative.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enterpriseId: "ent-1",
          pillarId: "pillar-gov",
        }),
      }),
    );
  });
});

describe("syncEnterpriseMethodologyToAdvisorInTx", () => {
  it("creates advisor pillar overrides from enterprise defaults", async () => {
    const tx = createMethodologyTx({
      enterprisePillarOverride: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ent-override-1",
            pillarId: "pillar-gov",
            isActive: true,
            displayName: "Firm governance",
            weight: 15,
            threshold: { lowMin: 10, mediumMin: 20, highMin: 30 },
            sectionWeights: null,
            emphasisMultiplier: 1.5,
            displayOrder: 1,
          },
        ]),
      },
    });

    const changed = await syncEnterpriseMethodologyToAdvisorInTx(
      tx,
      "ent-1",
      "profile-member",
    );

    expect(changed).toBe(true);
    expect(tx.advisorPillarOverride.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        advisorProfileId: "profile-member",
        pillarId: "pillar-gov",
        enterpriseSourceId: "ent-override-1",
        weight: 15,
        displayName: "Firm governance",
      }),
    });
  });

  it("updates linked advisor assessment questions when enterprise copy changes", async () => {
    const tx = createMethodologyTx({
      enterprisePillarQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ent-assess-1",
            pillarId: "pillar-gov",
            sourceKind: AdvisorQuestionSource.PLATFORM,
            platformSourceId: "platform-q-1",
            sectionCode: "A",
            displayOrder: 0,
            questionNumber: "1",
            questionText: "Updated firm question text",
            answerType: "scored_0_3",
            scoreMap: { "0": 0, "1": 1, "2": 2, "3": 3 },
            whyThisMatters: "Because",
            recommendedActions: null,
            isVisible: true,
            isKeyRiskIndicator: false,
            relatedPillarIds: [],
          },
        ]),
      },
      advisorPillarQuestion: {
        findMany: vi.fn().mockResolvedValue([
          { id: "adv-assess-1", enterpriseSourceId: "ent-assess-1", platformSourceId: "platform-q-1" },
        ]),
      },
    });

    const changed = await syncEnterpriseMethodologyToAdvisorInTx(
      tx,
      "ent-1",
      "profile-member",
    );

    expect(changed).toBe(true);
    expect(tx.advisorPillarQuestion.update).toHaveBeenCalledWith({
      where: { id: "adv-assess-1" },
      data: expect.objectContaining({
        questionText: "Updated firm question text",
        whyThisMatters: "Because",
        version: { increment: 1 },
      }),
    });
  });

  it("creates missing advisor intake clones from enterprise intake rows", async () => {
    const tx = createMethodologyTx({
      enterpriseIntakeQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ent-intake-1",
            sourceKind: AdvisorQuestionSource.CUSTOM,
            platformSourceId: null,
            displayOrder: 0,
            questionNumber: "1",
            questionText: "Firm intake question",
            context: "Context",
            helpText: "Help",
            learnMore: null,
            answerType: "audio",
            options: null,
            relatedPillarIds: [],
            recommendedActions: null,
            isVisible: true,
          },
        ]),
      },
      advisorIntakeQuestion: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const changed = await syncEnterpriseMethodologyToAdvisorInTx(
      tx,
      "ent-1",
      "profile-member",
    );

    expect(changed).toBe(true);
    expect(tx.advisorIntakeQuestion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        advisorProfile: { connect: { id: "profile-member" } },
        enterpriseSource: { connect: { id: "ent-intake-1" } },
        sourceKind: AdvisorQuestionSource.ENTERPRISE,
        questionText: "Firm intake question",
      }),
    });
  });
});

describe("syncEnterpriseMethodologyToMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("syncs methodology to every active firm advisor profile", async () => {
    const tx = createMethodologyTx({
      enterprisePillarOverride: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ent-override-1",
            pillarId: "pillar-gov",
            isActive: true,
            displayName: null,
            weight: 10,
            threshold: { lowMin: 1, mediumMin: 2, highMin: 3 },
            sectionWeights: null,
            emphasisMultiplier: 1.5,
            displayOrder: 1,
          },
        ]),
      },
    });

    prismaSpies.enterpriseMembership.findMany.mockResolvedValue([
      { advisorProfileId: "profile-a" },
      { advisorProfileId: "profile-b" },
    ]);
    prismaSpies.$transaction.mockImplementation(
      async (fn: (innerTx: MethodologyTx) => Promise<boolean>) => fn(tx),
    );

    const result = await syncEnterpriseMethodologyToMembers("ent-1");

    expect(result.advisorsUpdated).toBe(2);
    expect(prismaSpies.$transaction).toHaveBeenCalledTimes(2);
    expect(tx.advisorPillarOverride.create).toHaveBeenCalledTimes(2);
  });
});
