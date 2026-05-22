import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvitationStatus } from "@prisma/client";

const prismaSpies = vi.hoisted(() => ({
  inviteCode: { updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import { markInvitationOpened } from "./mark-opened";

describe("markInvitationOpened (US-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only advances SENT invitations to OPENED", async () => {
    await markInvitationOpened("invite-1");

    expect(prismaSpies.inviteCode.updateMany).toHaveBeenCalledWith({
      where: { id: "invite-1", status: InvitationStatus.SENT },
      data: {
        status: InvitationStatus.OPENED,
        statusUpdatedAt: expect.any(Date),
      },
    });
  });
});
