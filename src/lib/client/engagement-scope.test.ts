import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAssignmentFindFirst = vi.fn();
const mockAssignmentFindUnique = vi.fn();
const mockAssignmentUpdate = vi.fn();
const mockApprovalFindFirst = vi.fn();
const mockAssessmentFindFirst = vi.fn();
const mockSyncScope = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findFirst: (...args: unknown[]) => mockAssignmentFindFirst(...args),
      findUnique: (...args: unknown[]) => mockAssignmentFindUnique(...args),
      update: (...args: unknown[]) => mockAssignmentUpdate(...args),
    },
    intakeApproval: {
      findFirst: (...args: unknown[]) => mockApprovalFindFirst(...args),
    },
    assessment: {
      findFirst: (...args: unknown[]) => mockAssessmentFindFirst(...args),
    },
  },
}));

vi.mock("@/lib/assessment/sync-client-assessment-scope", () => ({
  syncInProgressAssessmentScope: (...args: unknown[]) => mockSyncScope(...args),
}));

vi.mock("@/lib/methodology/cached-pillar-catalog", async () => {
  const { starterPillarCatalog } = await import("@/lib/methodology/pillar-catalog");
  return {
    getPlatformPillarCatalog: vi.fn(async () => starterPillarCatalog()),
  };
});

import {
  getClientEngagementScope,
  persistClientEngagementScope,
  widenAssignmentScopeFromAssessment,
} from "@/lib/client/engagement-scope";

describe("widenAssignmentScopeFromAssessment", () => {
  it("expands included and focus when assessment is a strict superset", () => {
    const result = widenAssignmentScopeFromAssessment(
      ["governance", "cyber-digital"],
      ["governance", "cyber-digital"],
      ["governance", "cyber-digital", "ai-emerging-tech"],
    );
    expect(result).toEqual({
      includedPillars: ["governance", "cyber-digital", "ai-emerging-tech"],
      focusAreas: ["governance", "cyber-digital", "ai-emerging-tech"],
    });
  });

  it("keeps a true emphasis subset when widening included", () => {
    const result = widenAssignmentScopeFromAssessment(
      ["governance", "cyber-digital", "physical-security"],
      ["governance"],
      ["governance", "cyber-digital", "physical-security", "ai-emerging-tech"],
    );
    expect(result).toEqual({
      includedPillars: [
        "governance",
        "cyber-digital",
        "physical-security",
        "ai-emerging-tech",
      ],
      focusAreas: ["governance"],
    });
  });

  it("returns null when assessment is not wider", () => {
    expect(
      widenAssignmentScopeFromAssessment(
        ["governance", "cyber-digital"],
        ["governance"],
        ["governance", "cyber-digital"],
      ),
    ).toBeNull();
  });
});

describe("getClientEngagementScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssignmentUpdate.mockResolvedValue({});
    mockApprovalFindFirst.mockResolvedValue(null);
    mockAssessmentFindFirst.mockResolvedValue(null);
  });

  it("widens assignment when assessment included is a strict superset", async () => {
    mockAssignmentFindFirst.mockResolvedValue({
      id: "asg-1",
      intakeWaivedAt: null,
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance", "cyber-digital"],
    });
    mockAssessmentFindFirst.mockResolvedValue({
      includedPillars: ["governance", "cyber-digital", "ai-emerging-tech"],
    });

    const scope = await getClientEngagementScope("client-1");

    expect(mockAssignmentUpdate).toHaveBeenCalledWith({
      where: { id: "asg-1" },
      data: {
        includedPillars: ["governance", "cyber-digital", "ai-emerging-tech"],
        focusAreas: ["governance", "cyber-digital", "ai-emerging-tech"],
      },
    });
    expect(scope.includedPillars).toEqual([
      "governance",
      "cyber-digital",
      "ai-emerging-tech",
    ]);
    expect(scope.focusAreas).toEqual([
      "governance",
      "cyber-digital",
      "ai-emerging-tech",
    ]);
  });

  it("returns assignment scope when set (canonical path)", async () => {
    mockAssignmentFindFirst.mockResolvedValue({
      id: "asg-1",
      intakeWaivedAt: new Date(),
      includedPillars: ["cyber-digital"],
      focusAreas: ["cyber-digital"],
    });

    const scope = await getClientEngagementScope("client-1", { reconcile: false });

    expect(scope).toMatchObject({
      includedPillars: ["cyber-digital"],
      source: "assignment",
      assignmentId: "asg-1",
      intakeWaived: true,
    });
    expect(mockApprovalFindFirst).not.toHaveBeenCalled();
  });

  it("reconciles legacy approval scope onto assignment on read", async () => {
    mockAssignmentFindFirst.mockResolvedValue({
      id: "asg-1",
      intakeWaivedAt: null,
      includedPillars: [],
      focusAreas: [],
    });
    mockApprovalFindFirst.mockResolvedValue({
      id: "appr-1",
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance"],
    });

    const scope = await getClientEngagementScope("client-1");

    expect(scope.source).toBe("approval");
    expect(scope.includedPillars).toEqual(["governance", "cyber-digital"]);
    expect(mockAssignmentUpdate).toHaveBeenCalledWith({
      where: { id: "asg-1" },
      data: {
        includedPillars: ["governance", "cyber-digital"],
        focusAreas: ["governance"],
      },
    });
  });
});

describe("persistClientEngagementScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssignmentFindFirst.mockResolvedValue({ id: "asg-1" });
    mockAssignmentUpdate.mockResolvedValue({});
    mockSyncScope.mockResolvedValue(undefined);
  });

  it("writes assignment and syncs in-progress assessment", async () => {
    await persistClientEngagementScope({
      clientId: "client-1",
      includedPillars: ["governance"],
      focusAreas: ["governance"],
      approvalId: "appr-1",
    });

    expect(mockAssignmentUpdate).toHaveBeenCalled();
    expect(mockSyncScope).toHaveBeenCalledWith(
      "client-1",
      ["governance"],
      "appr-1",
    );
  });
});
