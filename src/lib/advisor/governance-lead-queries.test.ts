import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdvisorRoleSpy,
  getAdvisorProfileOrThrowSpy,
  governanceReviewLeadFindManySpy,
  governanceReviewLeadFindFirstSpy,
} = vi.hoisted(() => ({
  requireAdvisorRoleSpy: vi.fn().mockResolvedValue({ userId: "user-1", role: "ADVISOR" }),
  getAdvisorProfileOrThrowSpy: vi.fn().mockResolvedValue({ id: "advisor-profile-1" }),
  governanceReviewLeadFindManySpy: vi.fn().mockResolvedValue([]),
  governanceReviewLeadFindFirstSpy: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: () => requireAdvisorRoleSpy(),
  getAdvisorProfileOrThrow: (userId: string) => getAdvisorProfileOrThrowSpy(userId),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    governanceReviewLead: {
      findMany: governanceReviewLeadFindManySpy,
      findFirst: governanceReviewLeadFindFirstSpy,
    },
    advisorNotification: {
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import {
  getAssignedGovernanceLeadForAdvisor,
  getAssignedGovernanceLeadsForAdvisor,
} from "@/lib/advisor/governance-lead-queries";

describe("governance-lead-queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdvisorRoleSpy.mockResolvedValue({ userId: "user-1", role: "ADVISOR" });
    getAdvisorProfileOrThrowSpy.mockResolvedValue({ id: "advisor-profile-1" });
  });

  it("lists leads assigned to the signed-in advisor only", async () => {
    await getAssignedGovernanceLeadsForAdvisor();

    expect(governanceReviewLeadFindManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assignedAdvisorId: "advisor-profile-1" },
      })
    );
  });

  it("loads a single lead scoped to the signed-in advisor", async () => {
    await getAssignedGovernanceLeadForAdvisor("lead-1");

    expect(governanceReviewLeadFindFirstSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead-1", assignedAdvisorId: "advisor-profile-1" },
      })
    );
  });

  it("returns null for blank lead ids", async () => {
    await expect(getAssignedGovernanceLeadForAdvisor("  ")).resolves.toBeNull();
    expect(governanceReviewLeadFindFirstSpy).not.toHaveBeenCalled();
  });
});
