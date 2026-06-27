import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/db", () => ({
  prisma: {
    solutionMilestone: { findUnique: vi.fn() },
    clientAdvisorAssignment: { findFirst: vi.fn() },
    assessment: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: vi.fn(),
}));

vi.mock("@/lib/recommendations/solution-lifecycle", () => ({
  updateMilestoneStatus: vi.fn(),
}));

vi.mock("@/lib/engagement/publish-action-plan", () => ({
  publishActionPlan: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { updateMilestoneStatus } from "@/lib/recommendations/solution-lifecycle";
import { publishActionPlan } from "@/lib/engagement/publish-action-plan";
import {
  blockMilestone,
  deferMilestone,
  publishActionPlanAction,
  updateMilestoneStatusAction,
} from "./engagement-actions";

const mockRequireAdvisorRole = vi.mocked(requireAdvisorRole);
const mockUpdateMilestoneStatus = vi.mocked(updateMilestoneStatus);
const mockPublishActionPlan = vi.mocked(publishActionPlan);

const ADVISOR_USER_ID = "cm1advisoruser001";
const MILESTONE_ID = "cm1milestone00001";
const CLIENT_ID = "cm1clientuser0001";
const ASSESSMENT_ID = "cm1assessment001";

function setupMilestoneOwnership() {
  vi.mocked(prisma.solutionMilestone.findUnique).mockResolvedValue({
    assessmentRecommendation: {
      assessment: { userId: CLIENT_ID },
    },
  } as never);
  vi.mocked(prisma.clientAdvisorAssignment.findFirst).mockResolvedValue({
    id: "assign-1",
  } as never);
}

function setupAssessmentOwnership() {
  vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
    userId: CLIENT_ID,
  } as never);
  vi.mocked(prisma.clientAdvisorAssignment.findFirst).mockResolvedValue({
    id: "assign-1",
  } as never);
}

describe("engagement-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdvisorRole.mockResolvedValue({
      userId: ADVISOR_USER_ID,
      role: "ADVISOR",
      email: "advisor@test.com",
    });
  });

  describe("blockMilestone", () => {
    it("rejects when user is not advisor", async () => {
      mockRequireAdvisorRole.mockRejectedValue(
        new Error("Unauthorized: Advisor access required")
      );

      const result = await blockMilestone({
        milestoneId: MILESTONE_ID,
        reason: "Waiting for external vendor approval before proceeding",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Unauthorized: Advisor access required");
      }
    });

    it("calls updateMilestoneStatus with BLOCKED and reason", async () => {
      setupMilestoneOwnership();
      mockUpdateMilestoneStatus.mockResolvedValue(undefined);

      const result = await blockMilestone({
        milestoneId: MILESTONE_ID,
        reason: "Waiting for external vendor approval before proceeding",
      });

      expect(result.success).toBe(true);
      expect(mockUpdateMilestoneStatus).toHaveBeenCalledWith({
        milestoneId: MILESTONE_ID,
        status: "BLOCKED",
        actorId: ADVISOR_USER_ID,
        reason: "Waiting for external vendor approval before proceeding",
      });
    });

    it("rejects when advisor does not own milestone", async () => {
      vi.mocked(prisma.solutionMilestone.findUnique).mockResolvedValue({
        assessmentRecommendation: {
          assessment: { userId: CLIENT_ID },
        },
      } as never);
      vi.mocked(prisma.clientAdvisorAssignment.findFirst).mockResolvedValue(
        null
      );

      const result = await blockMilestone({
        milestoneId: MILESTONE_ID,
        reason: "Waiting for external vendor approval before proceeding",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authorized to manage this milestone");
      }
    });
  });

  describe("deferMilestone", () => {
    it("calls updateMilestoneStatus with DEFERRED, reason, and revisitDate", async () => {
      setupMilestoneOwnership();
      mockUpdateMilestoneStatus.mockResolvedValue(undefined);

      const result = await deferMilestone({
        milestoneId: MILESTONE_ID,
        reason: "Not a priority right now",
        revisitDate: "2026-09-01T00:00:00.000Z",
      });

      expect(result.success).toBe(true);
      expect(mockUpdateMilestoneStatus).toHaveBeenCalledWith({
        milestoneId: MILESTONE_ID,
        status: "DEFERRED",
        actorId: ADVISOR_USER_ID,
        reason: "Not a priority right now",
        revisitDate: new Date("2026-09-01T00:00:00.000Z"),
      });
    });
  });

  describe("updateMilestoneStatusAction", () => {
    it("updates milestone status for non-dialog changes", async () => {
      setupMilestoneOwnership();
      mockUpdateMilestoneStatus.mockResolvedValue(undefined);

      const result = await updateMilestoneStatusAction({
        milestoneId: MILESTONE_ID,
        status: "IN_PROGRESS",
      });

      expect(result.success).toBe(true);
      expect(mockUpdateMilestoneStatus).toHaveBeenCalledWith({
        milestoneId: MILESTONE_ID,
        status: "IN_PROGRESS",
        actorId: ADVISOR_USER_ID,
      });
    });
  });

  describe("publishActionPlanAction", () => {
    it("calls publishActionPlan with correct assessmentId", async () => {
      setupAssessmentOwnership();
      mockPublishActionPlan.mockResolvedValue({
        publishedAt: new Date(),
        recommendationCount: 5,
      });

      const result = await publishActionPlanAction({
        assessmentId: ASSESSMENT_ID,
      });

      expect(result.success).toBe(true);
      expect(mockPublishActionPlan).toHaveBeenCalledWith({
        assessmentId: ASSESSMENT_ID,
        actorId: ADVISOR_USER_ID,
      });
    });

    it("rejects when advisor does not own assessment", async () => {
      vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
        userId: CLIENT_ID,
      } as never);
      vi.mocked(prisma.clientAdvisorAssignment.findFirst).mockResolvedValue(
        null
      );

      const result = await publishActionPlanAction({
        assessmentId: ASSESSMENT_ID,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Not authorized to manage this assessment");
      }
    });
  });
});
