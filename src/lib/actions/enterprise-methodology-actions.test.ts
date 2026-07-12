import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdvisorQuestionSource } from "@prisma/client";

const prismaSpies = vi.hoisted(() => ({
  enterprisePillarQuestion: {
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  enterpriseIntakeQuestion: {
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
  advisorPillarQuestion: {
    deleteMany: vi.fn(),
  },
  advisorIntakeQuestion: {
    deleteMany: vi.fn(),
  },
  pillar: {
    findUnique: vi.fn(),
  },
  enterprisePillarOverride: {
    upsert: vi.fn(),
  },
}));

const syncMembers = vi.hoisted(() => vi.fn(async () => ({ advisorsUpdated: 1 })));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/methodology/clone-enterprise-methodology", () => ({
  syncEnterpriseMethodologyToMembers: syncMembers,
}));
vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: vi.fn(async () => ({ userId: "owner-user" })),
  advisorHubActionErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("@/lib/enterprise/team-access", () => ({
  requireEnterpriseTeamManager: vi.fn(async () => ({
    enterpriseId: "ent-1",
    enterpriseName: "Belvedere",
    role: "OWNER",
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Post-delete bank-mode housekeeping helpers. Mock them so the delete-guard
// assertions below don't drag in the heavy clone/sync chain these helpers use.
// Returning a non-zero custom count + PLATFORM mode keeps
// isCustomOnlyWithoutSavedQuestions() false, so no enterprise bank-mode switch runs.
vi.mock("@/lib/methodology/enterprise-methodology-queries", () => ({
  countEnterpriseCustomAssessmentQuestions: vi.fn(async () => 1),
  countEnterpriseCustomIntakeQuestions: vi.fn(async () => 1),
}));
vi.mock("@/lib/methodology/intake-question-bank-mode.server", () => ({
  resolveEnterpriseAssessmentQuestionBankMode: vi.fn(async () => "PLATFORM"),
  resolveEnterpriseIntakeQuestionBankMode: vi.fn(async () => "PLATFORM"),
}));

import {
  deleteEnterprisePillarQuestion,
  updateEnterprisePillarQuestion,
} from "@/lib/actions/enterprise-methodology-actions";

describe("enterprise methodology actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a firm assessment question and syncs to member advisors", async () => {
    prismaSpies.enterprisePillarQuestion.findFirst.mockResolvedValue({
      id: "ent-q-1",
      enterpriseId: "ent-1",
      pillar: { slug: "governance" },
    });
    prismaSpies.enterprisePillarQuestion.update.mockResolvedValue({});

    const result = await updateEnterprisePillarQuestion("ent-q-1", {
      questionText: "Firm-wide updated text",
      isVisible: false,
    });

    expect(result.success).toBe(true);
    expect(prismaSpies.enterprisePillarQuestion.update).toHaveBeenCalledWith({
      where: { id: "ent-q-1" },
      data: expect.objectContaining({
        questionText: "Firm-wide updated text",
        isVisible: false,
        version: { increment: 1 },
      }),
    });
    expect(syncMembers).toHaveBeenCalledWith("ent-1");
  });

  it("rejects deleting platform-base firm assessment questions", async () => {
    prismaSpies.enterprisePillarQuestion.findFirst.mockResolvedValue({
      id: "ent-q-platform",
      sourceKind: AdvisorQuestionSource.PLATFORM,
      pillar: { slug: "governance" },
    });

    const result = await deleteEnterprisePillarQuestion("ent-q-platform");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/cannot be deleted/i);
    }
    expect(prismaSpies.enterprisePillarQuestion.delete).not.toHaveBeenCalled();
    expect(syncMembers).not.toHaveBeenCalled();
  });

  it("deletes custom firm assessment questions and their advisor clones", async () => {
    prismaSpies.enterprisePillarQuestion.findFirst.mockResolvedValue({
      id: "ent-q-custom",
      sourceKind: AdvisorQuestionSource.CUSTOM,
      pillar: { slug: "governance" },
    });

    const result = await deleteEnterprisePillarQuestion("ent-q-custom");

    expect(result.success).toBe(true);
    expect(prismaSpies.advisorPillarQuestion.deleteMany).toHaveBeenCalledWith({
      where: { enterpriseSourceId: "ent-q-custom" },
    });
    expect(prismaSpies.enterprisePillarQuestion.delete).toHaveBeenCalledWith({
      where: { id: "ent-q-custom" },
    });
    expect(syncMembers).toHaveBeenCalledWith("ent-1");
  });
});
