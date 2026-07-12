import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdvisorRole: vi.fn(),
  getAdvisorProfileOrThrow: vi.fn(),
  assignmentFindFirst: vi.fn(),
  getRestartIntakeEligibility: vi.fn(),
  restartClientIntakeForUser: vi.fn(),
  writeAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: mocks.requireAdvisorRole,
  getAdvisorProfileOrThrow: mocks.getAdvisorProfileOrThrow,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findFirst: mocks.assignmentFindFirst,
    },
  },
}));

vi.mock("@/lib/intake/restart-intake", () => ({
  getRestartIntakeEligibility: mocks.getRestartIntakeEligibility,
  restartClientIntakeForUser: mocks.restartClientIntakeForUser,
  restartIntakeBlockedMessage: (reason: string) => `blocked:${reason}`,
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: mocks.writeAudit,
  AUDIT_ACTIONS: { INTAKE_RESTART: "intake.restart" },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { restartClientIntake } from "./advisor-intake-restart-actions";

describe("restartClientIntake", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdvisorRole.mockResolvedValue({
      userId: "adv-user",
      role: "ADVISOR",
      email: "advisor@test.com",
    });
    mocks.getAdvisorProfileOrThrow.mockResolvedValue({ id: "adv-profile" });
    mocks.assignmentFindFirst.mockResolvedValue({
      id: "assign-1",
      status: "ACTIVE",
      intakeWaivedAt: null,
    });
    mocks.getRestartIntakeEligibility.mockResolvedValue({ allowed: true });
    mocks.restartClientIntakeForUser.mockResolvedValue({
      interview: { id: "intake-new", status: "NOT_STARTED" },
      archivedCount: 1,
      archivedAssessmentCount: 1,
    });
  });

  it("archives prior intake and returns the new interview id", async () => {
    const result = await restartClientIntake({
      clientId: "clh7r9k2m4n6p8q0s2u4v6x8y0z2b4",
    });

    expect(result).toEqual({ success: true, interviewId: "intake-new" });
    expect(mocks.restartClientIntakeForUser).toHaveBeenCalledWith(
      "clh7r9k2m4n6p8q0s2u4v6x8y0z2b4",
    );
    expect(mocks.writeAudit).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/advisor/pipeline");
  });

  it("returns eligibility errors without mutating intake", async () => {
    mocks.getRestartIntakeEligibility.mockResolvedValue({
      allowed: false,
      reason: "facilitated_session_open",
    });

    const result = await restartClientIntake({
      clientId: "clh7r9k2m4n6p8q0s2u4v6x8y0z2b4",
    });

    expect(result).toEqual({
      success: false,
      error: "blocked:facilitated_session_open",
    });
    expect(mocks.restartClientIntakeForUser).not.toHaveBeenCalled();
  });
});
