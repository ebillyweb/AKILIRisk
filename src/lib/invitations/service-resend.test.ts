import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvitationStatus } from "@prisma/client";

const prismaSpies = vi.hoisted(() => ({
  inviteCode: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: (c: string) => c.replace(/^cipher:/, ""),
}));
vi.mock("@/lib/invite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/invite")>();
  return {
    ...actual,
    createInvitationToken: () => "token",
  };
});
vi.mock("@/lib/invitations/invitation-link", () => ({
  resolveInvitationLinkContextForSend: vi.fn(async () => ({
    origin: "https://app.test",
    usesAdvisorSubdomain: false,
  })),
  buildInvitationSignupUrl: (origin: string, token: string, cb: string) =>
    `${origin}/signup?invite=${token}&callbackUrl=${encodeURIComponent(cb)}`,
}));

import { invitationCanResend, resendInvitation } from "./service";

describe("invitationCanResend (US-8 / US-9)", () => {
  it("disallows resend for EXPIRED and REGISTERED", () => {
    expect(
      invitationCanResend({ status: InvitationStatus.EXPIRED, resendCount: 0 })
    ).toBe(false);
    expect(
      invitationCanResend({ status: InvitationStatus.REGISTERED, resendCount: 0 })
    ).toBe(false);
  });

  it("allows resend for SENT and OPENED under the cap", () => {
    expect(
      invitationCanResend({ status: InvitationStatus.SENT, resendCount: 0 })
    ).toBe(true);
    expect(
      invitationCanResend({ status: InvitationStatus.OPENED, resendCount: 2 })
    ).toBe(true);
    expect(
      invitationCanResend({ status: InvitationStatus.SENT, resendCount: 3 })
    ).toBe(false);
  });
});

describe("resendInvitation (US-8 / US-9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects resend when invitation is EXPIRED", async () => {
    prismaSpies.inviteCode.findUnique.mockResolvedValue({
      id: "inv-1",
      createdBy: "adv-profile",
      resendCount: 0,
      status: InvitationStatus.EXPIRED,
      intakeWaived: false,
      advisor: {
        id: "adv-profile",
        firmName: "Firm",
        user: { name: "A", emailCiphertext: "cipher:a@t.com" },
      },
    });

    await expect(resendInvitation("adv-profile", "inv-1")).rejects.toThrow(
      /cannot be resent/i
    );
    expect(prismaSpies.inviteCode.update).not.toHaveBeenCalled();
  });
});
