import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdvisorRole: vi.fn(),
  getAdvisorProfileOrThrow: vi.fn(),
  assignmentFindFirst: vi.fn(),
  assignmentUpdate: vi.fn(),
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
      update: mocks.assignmentUpdate,
    },
  },
}));

vi.mock("@/lib/audit/audit-log", () => ({
  writeAudit: mocks.writeAudit,
  AUDIT_ACTIONS: {
    CLIENT_ASSIGNMENT_DEACTIVATE: "client_assignment.deactivate",
    CLIENT_ASSIGNMENT_REACTIVATE: "client_assignment.reactivate",
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { setClientAssignmentStatus } from "./advisor-client-assignment-actions";

describe("setClientAssignmentStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdvisorRole.mockResolvedValue({
      userId: "adv-user",
      role: "ADVISOR",
      email: "advisor@test.com",
    });
    mocks.getAdvisorProfileOrThrow.mockResolvedValue({ id: "adv-profile" });
  });

  it("deactivates an active assignment", async () => {
    mocks.assignmentFindFirst.mockResolvedValue({
      id: "assign-1",
      status: "ACTIVE",
      client: { deletedAt: null },
    });
    mocks.assignmentUpdate.mockResolvedValue({});

    const result = await setClientAssignmentStatus({
      clientId: "clh7r9k2m4n6p8q0s2u4v6x8y0z2b4",
      status: "INACTIVE",
    });

    expect(result).toEqual({ success: true });
    expect(mocks.assignmentUpdate).toHaveBeenCalledWith({
      where: { id: "assign-1" },
      data: { status: "INACTIVE" },
    });
  });

  it("blocks reactivation when client account is soft-deleted", async () => {
    mocks.assignmentFindFirst.mockResolvedValue({
      id: "assign-1",
      status: "INACTIVE",
      client: { deletedAt: new Date() },
    });

    const result = await setClientAssignmentStatus({
      clientId: "clh7r9k2m4n6p8q0s2u4v6x8y0z2b4",
      status: "ACTIVE",
    });

    expect(result.success).toBe(false);
    expect(result).toMatchObject({
      error: expect.stringContaining("deactivated"),
    });
    expect(mocks.assignmentUpdate).not.toHaveBeenCalled();
  });
});
