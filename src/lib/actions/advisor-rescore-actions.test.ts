import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireAdvisorRoleSpy,
  getAdvisorProfileOrThrowSpy,
  findAssessmentSpy,
  findAssignmentSpy,
  findActorSpy,
  executeRescoreSpy,
} = vi.hoisted(() => ({
  requireAdvisorRoleSpy: vi.fn(),
  getAdvisorProfileOrThrowSpy: vi.fn(),
  findAssessmentSpy: vi.fn(),
  findAssignmentSpy: vi.fn(),
  findActorSpy: vi.fn(),
  executeRescoreSpy: vi.fn(),
}));

vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: () => requireAdvisorRoleSpy(),
  getAdvisorProfileOrThrow: (userId: string) =>
    getAdvisorProfileOrThrowSpy(userId),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: { findUnique: (...args: unknown[]) => findAssessmentSpy(...args) },
    clientAdvisorAssignment: {
      findFirst: (...args: unknown[]) => findAssignmentSpy(...args),
    },
    user: { findUnique: (...args: unknown[]) => findActorSpy(...args) },
  },
}));

vi.mock("@/lib/assessment/execute-assessment-rescore", () => ({
  executeAssessmentRescore: (...args: unknown[]) => executeRescoreSpy(...args),
}));

vi.mock("@/lib/auth/user-email", () => ({
  safeDecryptUserEmail: () => "buddy@ebilly.com",
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { advisorRescoreAssessment } from "./advisor-rescore-actions";

const ASSESSMENT_ID = "clxxxxxxxxxxxxxxxxxxxxxxxxx";

describe("advisorRescoreAssessment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findAssessmentSpy.mockResolvedValue({ userId: "client-1" });
    findActorSpy.mockResolvedValue({
      emailCiphertext: "ct",
      role: "SUPER_ADMIN",
    });
    executeRescoreSpy.mockResolvedValue({
      success: true,
      data: { newVersion: 2 },
    });
  });

  it("allows SUPER_ADMIN without an ACTIVE client assignment", async () => {
    requireAdvisorRoleSpy.mockResolvedValue({
      userId: "admin-1",
      role: "SUPER_ADMIN",
    });

    const result = await advisorRescoreAssessment({
      assessmentId: ASSESSMENT_ID,
    });

    expect(result.success).toBe(true);
    expect(findAssignmentSpy).not.toHaveBeenCalled();
    expect(getAdvisorProfileOrThrowSpy).not.toHaveBeenCalled();
    expect(executeRescoreSpy).toHaveBeenCalled();
  });

  it("rejects advisors without an ACTIVE assignment", async () => {
    requireAdvisorRoleSpy.mockResolvedValue({
      userId: "advisor-1",
      role: "ADVISOR",
    });
    getAdvisorProfileOrThrowSpy.mockResolvedValue({ id: "profile-1" });
    findAssignmentSpy.mockResolvedValue(null);

    const result = await advisorRescoreAssessment({
      assessmentId: ASSESSMENT_ID,
    });

    expect(result).toEqual({
      success: false,
      error: "You do not have access to this client",
    });
    expect(executeRescoreSpy).not.toHaveBeenCalled();
  });

  it("allows assigned advisors", async () => {
    requireAdvisorRoleSpy.mockResolvedValue({
      userId: "advisor-1",
      role: "ADVISOR",
    });
    getAdvisorProfileOrThrowSpy.mockResolvedValue({ id: "profile-1" });
    findAssignmentSpy.mockResolvedValue({ id: "asg-1" });
    findActorSpy.mockResolvedValue({
      emailCiphertext: "ct",
      role: "ADVISOR",
    });

    const result = await advisorRescoreAssessment({
      assessmentId: ASSESSMENT_ID,
    });

    expect(result.success).toBe(true);
    expect(findAssignmentSpy).toHaveBeenCalled();
  });
});
