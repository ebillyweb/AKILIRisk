import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorEnterprise: { findUnique: vi.fn() },
  auditLog: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
}));

const sendNotification = vi.hoisted(() => vi.fn(async () => ({ emailSent: true, inAppCreated: true })));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/notifications/service", () => ({ sendNotification }));
vi.mock("@/lib/public-app-url", () => ({
  getPublicAppUrlStrict: () => "https://preview.akilirisk.com",
}));
vi.mock("@/lib/auth/user-email", () => ({
  userEmailForDisplay: (user: { emailCiphertext: string }) => user.emailCiphertext,
}));

import {
  enterpriseProvisionCompleteReferenceId,
  notifyEnterpriseProvisionComplete,
} from "./enterprise-provision-notifications";

const ENTERPRISE_ID = "ent-1";

describe("notifyEnterpriseProvisionComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      id: ENTERPRISE_ID,
      name: "Belvedere Group",
      slug: "belvedere-group",
      subscription: { tier: "PROFESSIONAL" },
      memberships: [
        {
          advisorProfileId: "profile-owner",
          user: {
            id: "owner-user",
            name: "Owner Advisor",
            emailCiphertext: "owner@test.com",
          },
        },
      ],
    });

    prismaSpies.auditLog.findMany.mockResolvedValue([
      { actorUserId: "admin-user", afterData: { provisionSubmitted: true } },
    ]);

    prismaSpies.user.findUnique.mockResolvedValue({
      id: "admin-user",
      name: "Platform Admin",
      emailCiphertext: "admin@test.com",
      role: "ADMIN",
    });
  });

  it("notifies owner and provisioning admin", async () => {
    await notifyEnterpriseProvisionComplete({
      enterpriseId: ENTERPRISE_ID,
      actorUserId: "admin-user",
    });

    expect(sendNotification).toHaveBeenCalledTimes(2);

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "owner-user",
        recipientEmail: "owner@test.com",
        advisorProfileId: "profile-owner",
        referenceId: enterpriseProvisionCompleteReferenceId(ENTERPRISE_ID),
        title: "Belvedere Group is ready",
      }),
    );

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: "admin-user",
        recipientEmail: "admin@test.com",
        referenceId: `${enterpriseProvisionCompleteReferenceId(ENTERPRISE_ID)}:admin`,
        title: "Belvedere Group provisioning complete",
      }),
    );
  });

  it("skips admin notification when admin is the owner", async () => {
    prismaSpies.user.findUnique.mockResolvedValue({
      id: "owner-user",
      name: "Owner Advisor",
      emailCiphertext: "owner@test.com",
      role: "ADMIN",
    });

    await notifyEnterpriseProvisionComplete({
      enterpriseId: ENTERPRISE_ID,
      actorUserId: "owner-user",
    });

    expect(sendNotification).toHaveBeenCalledTimes(1);
  });
});
