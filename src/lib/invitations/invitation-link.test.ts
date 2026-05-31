import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorProfile: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import { buildInvitationSignupUrl, resolveInvitationLinkContext } from "./invitation-link";

describe("invitation-link", () => {
  const originalDomain = process.env.PRODUCTION_DOMAIN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRODUCTION_DOMAIN = "akilirisk.com";
  });

  afterEach(() => {
    process.env.PRODUCTION_DOMAIN = originalDomain;
  });

  it("uses advisor subdomain origin when white-label is enabled and verified", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      brandingEnabled: true,
      subdomain: {
        subdomain: "independent-wealth",
        isActive: true,
        dnsVerified: true,
      },
    });

    const ctx = await resolveInvitationLinkContext("adv-1", {
      customSubdomainEnabled: true,
    });

    expect(ctx.usesAdvisorSubdomain).toBe(true);
    expect(ctx.origin).toBe("https://independent-wealth.akilirisk.com");
  });

  it("uses advisor subdomain without customDomainEnabled (platform tenant only)", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      brandingEnabled: true,
      subdomain: {
        subdomain: "ebilly",
        isActive: true,
        dnsVerified: true,
      },
    });

    const ctx = await resolveInvitationLinkContext("adv-1", {
      customSubdomainEnabled: true,
    });

    expect(ctx.usesAdvisorSubdomain).toBe(true);
    expect(ctx.origin).toBe("https://ebilly.akilirisk.com");
  });

  it("falls back to platform origin when branding is disabled", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      brandingEnabled: false,
      subdomain: {
        subdomain: "independent-wealth",
        isActive: true,
        dnsVerified: true,
      },
    });

    const ctx = await resolveInvitationLinkContext("adv-1", {
      customSubdomainEnabled: true,
    });

    expect(ctx.usesAdvisorSubdomain).toBe(false);
  });

  it("falls back to platform origin when subdomain is not verified", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      brandingEnabled: true,
      subdomain: {
        subdomain: "pending-firm",
        isActive: false,
        dnsVerified: false,
      },
    });

    const ctx = await resolveInvitationLinkContext("adv-1", {
      customSubdomainEnabled: true,
    });

    expect(ctx.usesAdvisorSubdomain).toBe(false);
    expect(ctx.origin).not.toContain("pending-firm");
  });

  it("builds signup URL with invite token and callback", () => {
    const url = buildInvitationSignupUrl(
      "https://firm.akilirisk.com",
      "token-abc",
      "/assessment"
    );
    expect(url).toBe(
      "https://firm.akilirisk.com/signup?invite=token-abc&callbackUrl=%2Fassessment"
    );
  });
});

describe("resolveInvitationLinkContextForSend", () => {
  const originalDomain = process.env.PRODUCTION_DOMAIN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRODUCTION_DOMAIN = "akilirisk.com";
  });

  afterEach(() => {
    process.env.PRODUCTION_DOMAIN = originalDomain;
  });

  it("returns tenant origin when branding is enabled and subdomain is ready", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      brandingEnabled: true,
      subdomain: {
        subdomain: "independent-wealth",
        isActive: true,
        dnsVerified: true,
      },
    });

    const { resolveInvitationLinkContextForSend } = await import("./invitation-link");
    const ctx = await resolveInvitationLinkContextForSend("adv-1", {
      customSubdomainEnabled: true,
    });

    expect(ctx.usesAdvisorSubdomain).toBe(true);
  });

  it("throws when branding is enabled but tenant link is not ready", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      brandingEnabled: true,
      subdomain: {
        subdomain: "pending-firm",
        isActive: false,
        dnsVerified: false,
      },
    });

    const { resolveInvitationLinkContextForSend, BrandedInvitationLinkNotReadyError } =
      await import("./invitation-link");

    await expect(
      resolveInvitationLinkContextForSend("adv-1", {
        customSubdomainEnabled: true,
      })
    ).rejects.toBeInstanceOf(BrandedInvitationLinkNotReadyError);
  });

  it("allows platform origin when branding is disabled", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      brandingEnabled: false,
      subdomain: null,
    });

    const { resolveInvitationLinkContextForSend } = await import("./invitation-link");
    const ctx = await resolveInvitationLinkContextForSend("adv-1", {
      customSubdomainEnabled: true,
    });

    expect(ctx.usesAdvisorSubdomain).toBe(false);
  });
});
