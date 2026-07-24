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
  narrowAssessmentScopeFromEngagement,
  persistClientEngagementScope,
  pickResolvedIncludedPillars,
} from "@/lib/client/engagement-scope";
import { starterPillarCatalog } from "@/lib/methodology/pillar-catalog";

const catalog = starterPillarCatalog();

describe("pickResolvedIncludedPillars", () => {
  it("prefers engagement when assessment is a strict superset", () => {
    expect(
      pickResolvedIncludedPillars(
        {
          assessmentIncludedPillars: [
            "governance",
            "cyber-digital",
            "ai-emerging-tech",
          ],
          engagementIncludedPillars: ["governance", "cyber-digital"],
          hasAssessmentRow: true,
        },
        catalog,
      ),
    ).toEqual(["governance", "cyber-digital"]);
  });

  it("keeps a narrower assessment freeze within engagement", () => {
    expect(
      pickResolvedIncludedPillars(
        {
          assessmentIncludedPillars: ["governance"],
          engagementIncludedPillars: ["governance", "cyber-digital"],
          hasAssessmentRow: true,
        },
        catalog,
      ),
    ).toEqual(["governance"]);
  });

  it("uses engagement when assessment is empty", () => {
    expect(
      pickResolvedIncludedPillars(
        {
          assessmentIncludedPillars: [],
          engagementIncludedPillars: ["insurance"],
          hasAssessmentRow: true,
        },
        catalog,
      ),
    ).toEqual(["insurance"]);
  });
});

describe("narrowAssessmentScopeFromEngagement", () => {
  it("returns engagement when assessment is a strict superset", () => {
    expect(
      narrowAssessmentScopeFromEngagement(
        ["governance", "cyber-digital"],
        ["governance", "cyber-digital", "ai-emerging-tech"],
      ),
    ).toEqual(["governance", "cyber-digital"]);
  });

  it("returns null when assessment is not wider", () => {
    expect(
      narrowAssessmentScopeFromEngagement(
        ["governance", "cyber-digital"],
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
    mockSyncScope.mockResolvedValue(undefined);
  });

  it("narrows a wider assessment down to assignment included", async () => {
    mockAssignmentFindFirst.mockResolvedValue({
      id: "asg-1",
      intakeWaivedAt: null,
      assessmentWaivedAt: null,
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance", "cyber-digital"],
    });
    mockAssessmentFindFirst.mockResolvedValue({
      includedPillars: ["governance", "cyber-digital", "ai-emerging-tech"],
    });

    const scope = await getClientEngagementScope("client-1");

    expect(mockSyncScope).toHaveBeenCalledWith(
      "client-1",
      ["governance", "cyber-digital"],
      null,
    );
    expect(scope.includedPillars).toEqual(["governance", "cyber-digital"]);
    expect(mockAssignmentUpdate).not.toHaveBeenCalled();
  });

  it("returns assignment scope when set (canonical path)", async () => {
    mockAssignmentFindFirst.mockResolvedValue({
      id: "asg-1",
      intakeWaivedAt: new Date(),
      assessmentWaivedAt: null,
      includedPillars: ["cyber-digital"],
      focusAreas: ["cyber-digital"],
    });

    const scope = await getClientEngagementScope("client-1", { reconcile: false });

    expect(scope).toMatchObject({
      includedPillars: ["cyber-digital"],
      source: "assignment",
      assignmentId: "asg-1",
      intakeWaived: true,
      assessmentWaived: false,
    });
    expect(mockApprovalFindFirst).not.toHaveBeenCalled();
  });

  it("reconciles legacy approval scope onto assignment on read", async () => {
    mockAssignmentFindFirst.mockResolvedValue({
      id: "asg-1",
      intakeWaivedAt: null,
      assessmentWaivedAt: null,
      includedPillars: [],
      focusAreas: [],
    });
    mockApprovalFindFirst.mockResolvedValue({
      id: "appr-1",
      includedPillars: ["governance", "cyber-digital"],
      focusAreas: ["governance"],
    });

    const scope = await getClientEngagementScope("client-1");

    expect(mockAssignmentUpdate).toHaveBeenCalledWith({
      where: { id: "asg-1" },
      data: {
        includedPillars: ["governance", "cyber-digital"],
        focusAreas: ["governance"],
      },
    });
    expect(scope.source).toBe("approval");
    expect(scope.includedPillars).toEqual(["governance", "cyber-digital"]);
  });
});

describe("persistClientEngagementScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssignmentFindFirst.mockResolvedValue({
      id: "asg-1",
      intakeWaivedAt: null,
      assessmentWaivedAt: null,
      includedPillars: [],
      focusAreas: [],
    });
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
