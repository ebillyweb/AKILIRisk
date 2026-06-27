import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    assessmentRecommendation: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    solutionActivity: {
      create: vi.fn(),
    },
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
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
import { auth } from "@/lib/auth";
import {
  updateTaskStatus,
  getClientActionPlan,
} from "./client-action-plan-actions";

const mockPrisma = vi.mocked(prisma);
const mockAuth = vi.mocked(auth);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    user: { id: "client-1", email: "client@test.com" },
    expires: "2099-01-01",
  } as never);
});

describe("updateTaskStatus", () => {
  it("rejects when assessment.userId does not match session.user.id", async () => {
    mockPrisma.assessmentRecommendation.findUnique.mockResolvedValue({
      requiresValidation: false,
      assessment: { userId: "other-client" },
    } as never);

    const result = await updateTaskStatus({
      recommendationId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      taskStatus: "IN_PROGRESS",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authorized to update this recommendation");
    }
    expect(mockPrisma.assessmentRecommendation.update).not.toHaveBeenCalled();
  });

  it("creates validation_requested activity when COMPLETED + requiresValidation", async () => {
    mockPrisma.assessmentRecommendation.findUnique.mockResolvedValue({
      requiresValidation: true,
      assessment: { userId: "client-1" },
    } as never);
    mockPrisma.assessmentRecommendation.update.mockResolvedValue({} as never);
    mockPrisma.solutionActivity.create.mockResolvedValue({} as never);

    const result = await updateTaskStatus({
      recommendationId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      taskStatus: "COMPLETED",
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.solutionActivity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assessmentRecommendationId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        actorId: "client-1",
        action: "validation_requested",
      }),
    });
  });

  it("does not create validation activity when COMPLETED but requiresValidation is false", async () => {
    mockPrisma.assessmentRecommendation.findUnique.mockResolvedValue({
      requiresValidation: false,
      assessment: { userId: "client-1" },
    } as never);
    mockPrisma.assessmentRecommendation.update.mockResolvedValue({} as never);

    const result = await updateTaskStatus({
      recommendationId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
      taskStatus: "COMPLETED",
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.solutionActivity.create).not.toHaveBeenCalled();
  });
});

describe("getClientActionPlan", () => {
  it("excludes hiddenFromClient=true items", async () => {
    mockPrisma.assessmentRecommendation.findMany.mockResolvedValue([]);

    await getClientActionPlan();

    expect(
      mockPrisma.assessmentRecommendation.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hiddenFromClient: false,
        }),
      })
    );
  });

  it("only returns INCLUDED/IN_PROGRESS/COMPLETED status recommendations", async () => {
    mockPrisma.assessmentRecommendation.findMany.mockResolvedValue([]);

    await getClientActionPlan();

    expect(
      mockPrisma.assessmentRecommendation.findMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
        }),
      })
    );
  });

  it("groups items by timeHorizon with null defaulting to strategic", async () => {
    mockPrisma.assessmentRecommendation.findMany.mockResolvedValue([
      {
        id: "rec-1",
        serviceRecommendationId: "svc-1",
        status: "INCLUDED",
        taskStatus: "NOT_STARTED",
        validationStatus: "PENDING_REVIEW",
        requiresValidation: false,
        advisorPriority: null,
        advisorNotes: null,
        urgencyScore: 80,
        timeHorizon: "immediate",
        responsibleRoles: [],
        assignees: null,
        triggerReason: null,
        deferredRevisitDate: null,
        milestones: [],
        serviceRecommendation: {
          id: "svc-1",
          name: "Cyber Insurance",
          description: "Review cyber insurance",
          category: "Cyber",
          expectedOutcome: null,
          estimatedCost: "$5,000",
          timeframe: "30 days",
          provider: null,
        },
      },
      {
        id: "rec-2",
        serviceRecommendationId: "svc-2",
        status: "INCLUDED",
        taskStatus: "NOT_STARTED",
        validationStatus: "PENDING_REVIEW",
        requiresValidation: false,
        advisorPriority: null,
        advisorNotes: null,
        urgencyScore: 60,
        timeHorizon: null, // should default to "strategic"
        responsibleRoles: [],
        assignees: null,
        triggerReason: null,
        deferredRevisitDate: null,
        milestones: [],
        serviceRecommendation: {
          id: "svc-2",
          name: "Estate Planning",
          description: null,
          category: "Governance",
          expectedOutcome: null,
          estimatedCost: null,
          timeframe: null,
          provider: null,
        },
      },
    ] as never);

    const result = await getClientActionPlan();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.immediate).toHaveLength(1);
      expect(result.data.strategic).toHaveLength(1);
      expect(result.data.ongoing).toHaveLength(0);
    }
  });
});
