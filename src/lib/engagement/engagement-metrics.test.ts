import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: { findMany: vi.fn() },
    assessment: { findMany: vi.fn() },
    solutionActivity: { groupBy: vi.fn(), findFirst: vi.fn() },
    solutionMilestone: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import {
  getEngagementMetrics,
  getPortfolioEngagementData,
} from "./engagement-metrics";

const ADVISOR_PROFILE_ID = "advisor-profile-1";

describe("engagement-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getEngagementMetrics", () => {
    it("returns zeros when no published action plans exist", async () => {
      vi.mocked(prisma.clientAdvisorAssignment.findMany).mockResolvedValue([
        { clientId: "client-1" } as never,
      ]);
      vi.mocked(prisma.assessment.findMany).mockResolvedValue([]);

      const result = await getEngagementMetrics(ADVISOR_PROFILE_ID);

      expect(result).toEqual({
        overallCompletionPct: 0,
        activeClientCount: 0,
        stalledClientCount: 0,
        overdueMilestoneCount: 0,
      });
    });

    it("returns zeros when advisor has no clients", async () => {
      vi.mocked(prisma.clientAdvisorAssignment.findMany).mockResolvedValue([]);

      const result = await getEngagementMetrics(ADVISOR_PROFILE_ID);

      expect(result).toEqual({
        overallCompletionPct: 0,
        activeClientCount: 0,
        stalledClientCount: 0,
        overdueMilestoneCount: 0,
      });
    });

    it("computes stalled detection using 14-day threshold", async () => {
      vi.mocked(prisma.clientAdvisorAssignment.findMany).mockResolvedValue([
        { clientId: "client-1" } as never,
      ]);

      vi.mocked(prisma.assessment.findMany).mockResolvedValue([
        {
          id: "assessment-1",
          userId: "client-1",
          recommendations: [
            {
              id: "rec-1",
              status: "IN_PROGRESS",
              milestones: [
                { id: "ms-1", status: "IN_PROGRESS", dueDate: null },
              ],
            },
          ],
        },
      ] as never);

      // No recent activity -- should be stalled
      vi.mocked(prisma.solutionActivity.groupBy).mockResolvedValue([]);

      const result = await getEngagementMetrics(ADVISOR_PROFILE_ID);

      expect(result.stalledClientCount).toBe(1);
      expect(result.activeClientCount).toBe(1);
    });
  });

  describe("getPortfolioEngagementData", () => {
    it("excludes clients without published action plans", async () => {
      vi.mocked(prisma.clientAdvisorAssignment.findMany).mockResolvedValue([
        {
          clientId: "client-1",
          client: { assessments: [] }, // no published assessments
        },
        {
          clientId: "client-2",
          client: {
            assessments: [
              {
                recommendations: [
                  {
                    milestones: [
                      { status: "COMPLETED" },
                      { status: "IN_PROGRESS" },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ] as never);

      const result = await getPortfolioEngagementData(ADVISOR_PROFILE_ID);

      expect(result.has("client-1")).toBe(false);
      expect(result.has("client-2")).toBe(true);
      expect(result.get("client-2")).toEqual({
        completedCount: 1,
        totalCount: 2,
        blockedCount: 0,
      });
    });
  });
});
