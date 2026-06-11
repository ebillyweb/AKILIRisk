import { InvitationStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  inviteCode: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  clientAdvisorAssignment: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaSpies,
}));

vi.mock("@/lib/invite", () => ({
  verifyInviteToken: vi.fn(),
}));

vi.mock("@/lib/invitations/mark-opened", () => ({
  markInvitationOpened: vi.fn(),
}));

vi.mock("@/lib/invitations/provision-client", () => ({
  provisionClientFromInviteCode: vi.fn(),
}));

vi.mock("@/lib/auth/user-email", () => ({
  findUserByEmail: vi.fn(),
}));

import { verifyInviteToken } from "@/lib/invite";
import { markInvitationOpened } from "@/lib/invitations/mark-opened";
import { provisionClientFromInviteCode } from "@/lib/invitations/provision-client";
import { findUserByEmail } from "@/lib/auth/user-email";
import {
  redeemInvitationFromToken,
  reconcileAdvisorInvitationStatuses,
  syncInvitationStatusForClientEmail,
} from "@/lib/invitations/redeem-invitation";

describe("redeemInvitationFromToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks opened and provisions a valid invitation", async () => {
    vi.mocked(verifyInviteToken).mockReturnValue("invite-1");
    prismaSpies.inviteCode.findUnique.mockResolvedValue({
      prefillEmail: "client@test.com",
    });
    vi.mocked(provisionClientFromInviteCode).mockResolvedValue({
      ok: true,
      userId: "user-1",
      created: false,
    });

    const result = await redeemInvitationFromToken("token");

    expect(result).toEqual({ ok: true, inviteCodeId: "invite-1" });
    expect(markInvitationOpened).toHaveBeenCalledWith("invite-1");
    expect(provisionClientFromInviteCode).toHaveBeenCalledWith(
      "invite-1",
      "client@test.com",
    );
  });
});

describe("syncInvitationStatusForClientEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes status updates to the inviting advisor when provided", async () => {
    await syncInvitationStatusForClientEmail("client@test.com", "advisor-1");

    expect(prismaSpies.inviteCode.updateMany).toHaveBeenCalledWith({
      where: {
        prefillEmail: { equals: "client@test.com", mode: "insensitive" },
        status: {
          in: [InvitationStatus.SENT, InvitationStatus.OPENED],
        },
        createdBy: "advisor-1",
      },
      data: {
        status: InvitationStatus.REGISTERED,
        statusUpdatedAt: expect.any(Date),
      },
    });
  });
});

describe("reconcileAdvisorInvitationStatuses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promotes stale invites when the client is assigned to the advisor", async () => {
    prismaSpies.inviteCode.findMany.mockResolvedValue([
      { id: "invite-1", prefillEmail: "client@test.com" },
    ]);
    vi.mocked(findUserByEmail).mockResolvedValue({
      id: "user-1",
      role: "USER",
    } as Awaited<ReturnType<typeof findUserByEmail>>);
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({ id: "assign-1" });

    await reconcileAdvisorInvitationStatuses("advisor-1");

    expect(prismaSpies.inviteCode.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: {
        status: InvitationStatus.REGISTERED,
        statusUpdatedAt: expect.any(Date),
      },
    });
  });

  it("provisions and promotes stale invites when the client exists but is unassigned", async () => {
    prismaSpies.inviteCode.findMany.mockResolvedValue([
      { id: "invite-1", prefillEmail: "client@test.com" },
    ]);
    vi.mocked(findUserByEmail).mockResolvedValue({
      id: "user-1",
      role: "USER",
    } as Awaited<ReturnType<typeof findUserByEmail>>);
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);
    vi.mocked(provisionClientFromInviteCode).mockResolvedValue({
      ok: true,
      userId: "user-1",
      created: false,
    });

    await reconcileAdvisorInvitationStatuses("advisor-1");

    expect(provisionClientFromInviteCode).toHaveBeenCalledWith(
      "invite-1",
      "client@test.com",
    );
    expect(prismaSpies.inviteCode.update).toHaveBeenCalledWith({
      where: { id: "invite-1" },
      data: {
        status: InvitationStatus.REGISTERED,
        statusUpdatedAt: expect.any(Date),
      },
    });
  });

  it("leaves stale invites alone when provisioning fails", async () => {
    prismaSpies.inviteCode.findMany.mockResolvedValue([
      { id: "invite-1", prefillEmail: "client@test.com" },
    ]);
    vi.mocked(findUserByEmail).mockResolvedValue(null);
    vi.mocked(provisionClientFromInviteCode).mockResolvedValue({
      ok: false,
      error: "not found",
      code: "not_found",
    });

    await reconcileAdvisorInvitationStatuses("advisor-1");

    expect(prismaSpies.inviteCode.update).not.toHaveBeenCalled();
  });
});
