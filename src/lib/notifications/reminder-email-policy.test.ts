import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  DEFAULT_REMINDER_EMAIL_POLICY,
  getReminderEmailPolicyForAdvisorProfile,
  resolveReminderEmailPolicy,
} from "./reminder-email-policy";

vi.mock("@/lib/db", () => ({
  prisma: {
    advisorProfile: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

describe("resolveReminderEmailPolicy", () => {
  it("returns the provided flags", () => {
    expect(
      resolveReminderEmailPolicy({
        clientReminderEmailsEnabled: false,
        advisorReminderEmailsEnabled: true,
      }),
    ).toEqual({
      clientReminderEmailsEnabled: false,
      advisorReminderEmailsEnabled: true,
    });
  });
});

describe("getReminderEmailPolicyForAdvisorProfile", () => {
  beforeEach(() => {
    vi.mocked(prisma.advisorProfile.findUnique).mockReset();
  });

  it("returns defaults when profile is missing", async () => {
    vi.mocked(prisma.advisorProfile.findUnique).mockResolvedValue(null);

    await expect(getReminderEmailPolicyForAdvisorProfile("missing")).resolves.toEqual(
      DEFAULT_REMINDER_EMAIL_POLICY,
    );
  });

  it("uses enterprise policy for firm members", async () => {
    vi.mocked(prisma.advisorProfile.findUnique).mockResolvedValue({
      clientReminderEmailsEnabled: true,
      advisorReminderEmailsEnabled: true,
      enterpriseId: "ent-1",
      enterprise: {
        clientReminderEmailsEnabled: false,
        advisorReminderEmailsEnabled: false,
      },
    } as never);

    await expect(getReminderEmailPolicyForAdvisorProfile("profile-1")).resolves.toEqual({
      clientReminderEmailsEnabled: false,
      advisorReminderEmailsEnabled: false,
    });
  });

  it("uses solo profile policy when not in a firm", async () => {
    vi.mocked(prisma.advisorProfile.findUnique).mockResolvedValue({
      clientReminderEmailsEnabled: false,
      advisorReminderEmailsEnabled: true,
      enterpriseId: null,
      enterprise: null,
    } as never);

    await expect(getReminderEmailPolicyForAdvisorProfile("profile-1")).resolves.toEqual({
      clientReminderEmailsEnabled: false,
      advisorReminderEmailsEnabled: true,
    });
  });
});
