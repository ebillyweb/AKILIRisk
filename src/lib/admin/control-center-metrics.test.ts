import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { count: vi.fn() },
    assessment: { count: vi.fn() },
    intakeApproval: { count: vi.fn() },
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
const mockHealthSnapshot = vi.mocked(getOperationsHealthSnapshot);

describe("getControlCenterMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserCount.mockResolvedValue(0);
    mockAssessmentCount.mockResolvedValue(0);
    mockIntakeApprovalCount.mockResolvedValue(0);
    mockHealthSnapshot.mockResolvedValue({
      overall: "healthy",
      failedIntegrations: [],
    } as Awaited<ReturnType<typeof getOperationsHealthSnapshot>>);
  });

  it("maps platform health and failed integration counts", async () => {
    mockUserCount
      .mockResolvedValueOnce(5) // activeAdvisors
      .mockResolvedValueOnce(1) // newAdvisorsLast30d
      .mockResolvedValueOnce(0) // newAdvisorsPrior30d
      .mockResolvedValueOnce(10) // activeClients
      .mockResolvedValueOnce(8) // clientsWithSubmittedIntake
      .mockResolvedValueOnce(6) // clientsExisted30dAgo
      .mockResolvedValueOnce(4); // clientsWithIntakeBy30dAgo
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
