import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  intakeInterview: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  clientAdvisorAssignment: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaSpies,
}));

import { maybeReassignMisplacedIntakeToClient } from "./reassign-misplaced-intake";

describe("maybeReassignMisplacedIntakeToClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reassigns a submitted advisor-owned intake when one client candidate exists", async () => {
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-1",
      userId: "advisor-user",
      status: "SUBMITTED",
      submittedAt: new Date(),
      user: { role: "ADVISOR" },
    });
    prismaSpies.clientAdvisorAssignment.findMany.mockResolvedValue([
      { clientId: "client-user" },
    ]);
    prismaSpies.intakeInterview.update.mockResolvedValue({});

    const reassigned = await maybeReassignMisplacedIntakeToClient(
      "iv-1",
      "adv-profile",
      "advisor-user",
    );

    expect(reassigned).toBe(true);
    expect(prismaSpies.intakeInterview.update).toHaveBeenCalledWith({
      where: { id: "iv-1" },
      data: { userId: "client-user" },
    });
  });

  it("skips when intake is already on a client user", async () => {
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-1",
      userId: "client-user",
      status: "SUBMITTED",
      submittedAt: new Date(),
      user: { role: "USER" },
    });

    const reassigned = await maybeReassignMisplacedIntakeToClient(
      "iv-1",
      "adv-profile",
      "advisor-user",
    );

    expect(reassigned).toBe(false);
    expect(prismaSpies.clientAdvisorAssignment.findMany).not.toHaveBeenCalled();
  });

  it("skips when multiple client candidates are ambiguous", async () => {
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-1",
      userId: "advisor-user",
      status: "SUBMITTED",
      submittedAt: new Date(),
      user: { role: "ADVISOR" },
    });
    prismaSpies.clientAdvisorAssignment.findMany.mockResolvedValue([
      { clientId: "client-a" },
      { clientId: "client-b" },
    ]);

    const reassigned = await maybeReassignMisplacedIntakeToClient(
      "iv-1",
      "adv-profile",
      "advisor-user",
    );

    expect(reassigned).toBe(false);
    expect(prismaSpies.intakeInterview.update).not.toHaveBeenCalled();
  });
});
