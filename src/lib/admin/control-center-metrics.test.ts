import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { count: vi.fn() },
    assessment: { count: vi.fn() },
    intakeApproval: { count: vi.fn() },
    auditLog: { groupBy: vi.fn() },
  },
}));

vi.mock("@/lib/admin/operations-health", () => ({
  getOperationsHealthSnapshot: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getOperationsHealthSnapshot } from "@/lib/admin/operations-health";
import { getControlCenterMetrics } from "./control-center-metrics";

const mockUserCount = vi.mocked(prisma.user.count);
const mockAssessmentCount = vi.mocked(prisma.assessment.count);
const mockIntakeApprovalCount = vi.mocked(prisma.intakeApproval.count);
const mockAuditLogGroupBy = vi.mocked(prisma.auditLog.groupBy);
const mockHealthSnapshot = vi.mocked(getOperationsHealthSnapshot);

describe("getControlCenterMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserCount.mockResolvedValue(0);
    mockAssessmentCount.mockResolvedValue(0);
    mockIntakeApprovalCount.mockResolvedValue(0);
    mockAuditLogGroupBy.mockResolvedValue([]);
    mockHealthSnapshot.mockResolvedValue({
      overall: "healthy",
      failedIntegrations: [],
    } as unknown as Awaited<ReturnType<typeof getOperationsHealthSnapshot>>);
  });

  it("maps platform health and failed integration counts", async () => {
    mockAuditLogGroupBy
      .mockResolvedValueOnce([
        { actorUserId: "u1" },
        { actorUserId: "u2" },
        { actorUserId: "u3" },
      ] as Awaited<ReturnType<typeof prisma.auditLog.groupBy>>)
      .mockResolvedValueOnce([{ actorUserId: "u1" }] as Awaited<
        ReturnType<typeof prisma.auditLog.groupBy>
      >);
    let dashboardUserCountCall = 0;
    const dashboardUserCounts = [5, 1, 0, 10, 8, 6, 4];
    mockUserCount.mockImplementation(async (args) => {
      const actorIds =
        args?.where &&
        typeof args.where === "object" &&
        "id" in args.where &&
        args.where.id &&
        typeof args.where.id === "object" &&
        "in" in args.where.id
          ? (args.where.id.in as string[])
          : null;
      if (actorIds) return actorIds.length;
      return dashboardUserCounts[dashboardUserCountCall++] ?? 0;
    });
    mockAssessmentCount
      .mockResolvedValueOnce(3) // in progress
      .mockResolvedValueOnce(2) // started last 30d
      .mockResolvedValueOnce(1); // started prior 30d
    mockIntakeApprovalCount
      .mockResolvedValueOnce(4) // pendingReviews
      .mockResolvedValueOnce(6); // stalePendingReviews
    mockHealthSnapshot.mockResolvedValue({
      overall: "degraded",
      failedIntegrations: [{ id: "1" }, { id: "2" }],
    } as Awaited<ReturnType<typeof getOperationsHealthSnapshot>>);

    const metrics = await getControlCenterMetrics();

    expect(metrics.activeAdvisors.value).toBe(5);
    expect(metrics.dailyLogins).toEqual({
      value: 3,
      trend: { value: "+2", direction: "up" },
    });
    expect(metrics.assessmentsInProgress.value).toBe(3);
    expect(metrics.intakeCompletionRate.value).toBe("80%");
    expect(metrics.platformStatus).toEqual({
      value: "Degraded",
      status: "warning",
    });
    expect(metrics.failedIntegrations).toEqual({
      value: 2,
      status: "warning",
    });
    expect(metrics.pendingReviews.trend).toEqual({
      value: "-2",
      direction: "down",
    });
  });
});
