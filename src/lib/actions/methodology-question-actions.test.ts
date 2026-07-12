import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdvisorQuestionSource } from "@prisma/client";

const { prismaSpies } = vi.hoisted(() => ({
  prismaSpies: {
    advisorPillarQuestion: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    advisorIntakeQuestion: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    advisorRecommendationRule: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: vi.fn(async () => ({ userId: "user-1" })),
  getAdvisorProfileOrThrow: vi.fn(async () => ({ id: "profile-1" })),
  advisorHubActionErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Post-delete bank-mode housekeeping helpers. Mock them so the delete-guard
// assertions below don't drag in the heavy clone/sync chain these helpers use.
// Returning a non-zero custom count + PLATFORM mode keeps
// isCustomOnlyWithoutSavedQuestions() false, so no profile bank-mode switch runs.
vi.mock("@/lib/methodology/methodology-queries", () => ({
  countAdvisorCustomAssessmentQuestions: vi.fn(async () => 1),
  countAdvisorCustomIntakeQuestions: vi.fn(async () => 1),
}));
vi.mock("@/lib/methodology/intake-question-bank-mode.server", () => ({
  resolveAdvisorAssessmentQuestionBankMode: vi.fn(async () => "PLATFORM"),
  resolveAdvisorIntakeQuestionBankMode: vi.fn(async () => "PLATFORM"),
}));

import {
  deleteAdvisorIntakeQuestion,
  deleteAdvisorPillarQuestion,
  deleteAdvisorRecommendationRule,
} from "@/lib/actions/methodology-actions";

describe("methodology question delete guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects deleting platform assessment questions", async () => {
    prismaSpies.advisorPillarQuestion.findFirst.mockResolvedValue({
      id: "q1",
      sourceKind: AdvisorQuestionSource.PLATFORM,
      pillar: { slug: "governance" },
    });

    const result = await deleteAdvisorPillarQuestion("q1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/cannot be deleted/i);
    }
    expect(prismaSpies.advisorPillarQuestion.delete).not.toHaveBeenCalled();
  });

  it("deletes custom assessment questions", async () => {
    prismaSpies.advisorPillarQuestion.findFirst.mockResolvedValue({
      id: "q2",
      sourceKind: AdvisorQuestionSource.CUSTOM,
      pillar: { slug: "governance" },
    });

    const result = await deleteAdvisorPillarQuestion("q2");
    expect(result.success).toBe(true);
    expect(prismaSpies.advisorPillarQuestion.delete).toHaveBeenCalledWith({
      where: { id: "q2" },
    });
  });

  it("rejects deleting platform intake questions", async () => {
    prismaSpies.advisorIntakeQuestion.findFirst.mockResolvedValue({
      id: "iq1",
      sourceKind: AdvisorQuestionSource.PLATFORM,
    });

    const result = await deleteAdvisorIntakeQuestion("iq1");
    expect(result.success).toBe(false);
    expect(prismaSpies.advisorIntakeQuestion.delete).not.toHaveBeenCalled();
  });

  it("deletes custom intake questions", async () => {
    prismaSpies.advisorIntakeQuestion.findFirst.mockResolvedValue({
      id: "iq2",
      sourceKind: AdvisorQuestionSource.CUSTOM,
    });

    const result = await deleteAdvisorIntakeQuestion("iq2");
    expect(result.success).toBe(true);
    expect(prismaSpies.advisorIntakeQuestion.delete).toHaveBeenCalledWith({
      where: { id: "iq2" },
    });
  });

  it("rejects deleting platform recommendation rules", async () => {
    prismaSpies.advisorRecommendationRule.findFirst.mockResolvedValue({
      id: "rr1",
      sourceKind: AdvisorQuestionSource.PLATFORM,
      pillar: { slug: "governance" },
    });

    const result = await deleteAdvisorRecommendationRule("rr1");
    expect(result.success).toBe(false);
    expect(prismaSpies.advisorRecommendationRule.delete).not.toHaveBeenCalled();
  });

  it("deletes custom recommendation rules", async () => {
    prismaSpies.advisorRecommendationRule.findFirst.mockResolvedValue({
      id: "rr2",
      sourceKind: AdvisorQuestionSource.CUSTOM,
      pillar: { slug: "governance" },
    });

    const result = await deleteAdvisorRecommendationRule("rr2");
    expect(result.success).toBe(true);
    expect(prismaSpies.advisorRecommendationRule.delete).toHaveBeenCalledWith({
      where: { id: "rr2" },
    });
  });
});
