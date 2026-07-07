import { describe, it, expect, vi, beforeEach } from "vitest";

// Valid CUID-format test IDs
const REC_1 = "clxxxxxxxxxxxxxxxxxxrec01";
const REC_2 = "clxxxxxxxxxxxxxxxxxxrec02";
const REC_3 = "clxxxxxxxxxxxxxxxxxxrec03";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    assessmentRecommendation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    advisorProfile: {
      findUnique: vi.fn(),
    },
    clientAdvisorAssignment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    solutionActivity: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock auth
vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: vi.fn(),
}));

// Mock lifecycle
vi.mock("@/lib/recommendations/solution-lifecycle", () => ({
  transitionRecommendationStatus: vi.fn(),
}));

// Mock revalidation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock logging
vi.mock("@/lib/log-safe-error", () => ({
  logSafeError: vi.fn(),
  safeErrorMessage: vi.fn((_err: unknown, fallback: string) => fallback),
}));

import { prisma } from "@/lib/db";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { transitionRecommendationStatus } from "@/lib/recommendations/solution-lifecycle";
import {
  verifyAdvisorOwnsRecommendation,
  verifyAdvisorOwnsRecommendations,
  includeInActionPlan,
  deferRecommendation,
  hideFromClient,
} from "./guidance-actions";

const mockPrisma = vi.mocked(prisma);
const mockRequireAdvisorRole = vi.mocked(requireAdvisorRole);
const mockTransition = vi.mocked(transitionRecommendationStatus);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdvisorRole.mockResolvedValue({
    userId: "advisor-user-1",
    role: "ADVISOR",
    email: "advisor@test.com",
  });
});

describe("verifyAdvisorOwnsRecommendation", () => {
  it("returns true for valid advisor-client assignment", async () => {
    mockPrisma.assessmentRecommendation.findUnique.mockResolvedValue({
      assessment: { userId: "client-1" },
    } as never);
    mockPrisma.advisorProfile.findUnique.mockResolvedValue({
      id: "advisor-profile-1",
    } as never);
    mockPrisma.clientAdvisorAssignment.findFirst.mockResolvedValue({
      id: "assignment-1",
    } as never);

    const result = await verifyAdvisorOwnsRecommendation("advisor-user-1", REC_1);
    expect(result).toBe(true);

    expect(mockPrisma.clientAdvisorAssignment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          clientId: "client-1",
          advisorId: "advisor-profile-1",
          status: "ACTIVE",
        },
      })
    );
  });

  it("returns false when advisor does not own the client", async () => {
    mockPrisma.assessmentRecommendation.findUnique.mockResolvedValue({
      assessment: { userId: "client-1" },
    } as never);
    mockPrisma.advisorProfile.findUnique.mockResolvedValue({
      id: "advisor-profile-1",
    } as never);
    mockPrisma.clientAdvisorAssignment.findFirst.mockResolvedValue(null);

    const result = await verifyAdvisorOwnsRecommendation("advisor-user-1", REC_1);
    expect(result).toBe(false);
  });
});

describe("verifyAdvisorOwnsRecommendations", () => {
  it("returns correct valid/unauthorized split", async () => {
    mockPrisma.advisorProfile.findUnique.mockResolvedValue({
      id: "advisor-profile-1",
    } as never);
    mockPrisma.assessmentRecommendation.findMany.mockResolvedValue([
      { id: REC_1, assessment: { userId: "client-1" } },
      { id: REC_2, assessment: { userId: "client-2" } },
      { id: REC_3, assessment: { userId: "client-1" } },
    ] as never);
    // Only client-1 is assigned to this advisor
    mockPrisma.clientAdvisorAssignment.findMany.mockResolvedValue([
      { clientId: "client-1" },
    ] as never);

    const result = await verifyAdvisorOwnsRecommendations("advisor-user-1", [
      REC_1,
      REC_2,
      REC_3,
    ]);

    expect(result.valid).toEqual([REC_1, REC_3]);
    expect(result.unauthorized).toEqual([REC_2]);
  });
});

describe("includeInActionPlan", () => {
  it("rejects when advisor does not own the recommendation", async () => {
    mockPrisma.advisorProfile.findUnique.mockResolvedValue({
      id: "advisor-profile-1",
    } as never);
    mockPrisma.assessmentRecommendation.findMany.mockResolvedValue([
      { id: REC_1, assessment: { userId: "client-other" } },
    ] as never);
    mockPrisma.clientAdvisorAssignment.findMany.mockResolvedValue([]);

    const result = await includeInActionPlan({
      recommendationIds: [REC_1],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("No authorized recommendations found");
    }
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it("uses prisma.$transaction for bulk atomicity", async () => {
    mockPrisma.advisorProfile.findUnique.mockResolvedValue({
      id: "advisor-profile-1",
    } as never);
    mockPrisma.assessmentRecommendation.findMany.mockResolvedValue([
      { id: REC_1, assessment: { userId: "client-1" } },
      { id: REC_2, assessment: { userId: "client-1" } },
    ] as never);
    mockPrisma.clientAdvisorAssignment.findMany.mockResolvedValue([
      { clientId: "client-1" },
    ] as never);
    mockPrisma.$transaction.mockImplementation(async (fn) => {
      if (typeof fn === "function") return fn(mockPrisma as never);
      return [];
    });
    mockTransition.mockResolvedValue(undefined);

    const result = await includeInActionPlan({
      recommendationIds: [REC_1, REC_2],
    });

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results.every((r) => r.success)).toBe(true);
    }
  });
});

describe("deferRecommendation", () => {
  it("stores reason, revisitDate, triggerEvent via transitionRecommendationStatus", async () => {
    mockPrisma.assessmentRecommendation.findUnique.mockResolvedValue({
      assessment: { userId: "client-1" },
    } as never);
    mockPrisma.advisorProfile.findUnique.mockResolvedValue({
      id: "advisor-profile-1",
    } as never);
    mockPrisma.clientAdvisorAssignment.findFirst.mockResolvedValue({
      id: "assignment-1",
    } as never);
    mockTransition.mockResolvedValue(undefined);

    const result = await deferRecommendation({
      recommendationId: REC_1,
      reason: "Not actionable now",
      revisitDate: "2026-09-01T00:00:00Z",
      triggerEvent: "After valuation",
    });

    expect(result.success).toBe(true);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        recommendationId: REC_1,
        newStatus: "DEFERRED",
        reason: "Not actionable now",
        deferredRevisitDate: new Date("2026-09-01T00:00:00Z"),
        deferredTriggerEvent: "After valuation",
      })
    );
  });
});

describe("hideFromClient", () => {
  it("creates SolutionActivity audit record", async () => {
    mockPrisma.assessmentRecommendation.findUnique.mockResolvedValue({
      assessment: { userId: "client-1" },
    } as never);
    mockPrisma.advisorProfile.findUnique.mockResolvedValue({
      id: "advisor-profile-1",
    } as never);
    mockPrisma.clientAdvisorAssignment.findFirst.mockResolvedValue({
      id: "assignment-1",
    } as never);
    mockPrisma.assessmentRecommendation.update.mockResolvedValue({} as never);
    mockPrisma.solutionActivity.create.mockResolvedValue({} as never);

    const result = await hideFromClient({
      recommendationId: REC_1,
      hidden: true,
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.solutionActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assessmentRecommendationId: REC_1,
        actorId: "advisor-user-1",
        action: "hide_from_client",
        detail: { hidden: true },
      }),
    });
  });
});
