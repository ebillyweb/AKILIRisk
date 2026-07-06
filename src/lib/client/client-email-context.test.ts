import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  portalOriginFromSubdomainRow,
  resolveClientEmailContextForClientAdvisorAssignment,
} from "./client-email-context";

vi.mock("@/lib/db", () => ({
  prisma: {
    advisorProfile: {
      findUnique: vi.fn(),
    },
    advisorSubdomain: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/enterprise/branding", () => ({
  resolveAdvisorBrandingForProfile: vi.fn(),
}));

vi.mock("@/lib/client/client-portal-origin", () => ({
  buildAdvisorPortalOrigin: vi.fn((slug: string) => `https://${slug}.akilirisk.com`),
}));

vi.mock("@/lib/public-app-url", () => ({
  getPublicAppUrlStrict: vi.fn(() => "https://www.akilirisk.com"),
  getPublicAppUrlFromEnv: vi.fn(() => "https://www.akilirisk.com"),
}));

import { prisma } from "@/lib/db";
import { resolveAdvisorBrandingForProfile } from "@/lib/enterprise/branding";

const firmBranding = {
  brandingEnabled: true,
  advisorFirmName: "Independent Wealth Group",
  brandName: "Independent Wealth",
  tagline: "Governance for modern families",
  primaryColor: "#1a1a2e",
  secondaryColor: "#f5f5f5",
  accentColor: "#10b981",
  customDomainEnabled: false,
};

describe("portalOriginFromSubdomainRow", () => {
  it("uses tenant host when subdomain is active and verified", () => {
    expect(
      portalOriginFromSubdomainRow(
        {
          subdomain: "independent-wealth",
          isActive: true,
          dnsVerified: true,
        },
        "https://www.akilirisk.com",
      ),
    ).toEqual({
      origin: "https://independent-wealth.akilirisk.com",
      usesTenantHost: true,
    });
  });

  it("falls back to platform origin when subdomain is not ready", () => {
    expect(
      portalOriginFromSubdomainRow(
        {
          subdomain: "independent-wealth",
          isActive: false,
          dnsVerified: true,
        },
        "https://www.akilirisk.com",
      ),
    ).toEqual({
      origin: "https://www.akilirisk.com",
      usesTenantHost: false,
    });
  });
});

describe("resolveClientEmailContextForClientAdvisorAssignment", () => {
  beforeEach(() => {
    vi.mocked(prisma.advisorProfile.findUnique).mockReset();
    vi.mocked(prisma.advisorSubdomain.findFirst).mockReset();
    vi.mocked(resolveAdvisorBrandingForProfile).mockReset();
  });

  it("returns branded context with enterprise subdomain when member has no personal subdomain", async () => {
    vi.mocked(resolveAdvisorBrandingForProfile).mockResolvedValue(firmBranding);
    vi.mocked(prisma.advisorProfile.findUnique).mockResolvedValue({
      enterpriseId: "ent-1",
      subdomain: null,
    } as never);
    vi.mocked(prisma.advisorSubdomain.findFirst).mockResolvedValue({
      subdomain: "independent-wealth",
      isActive: true,
      dnsVerified: true,
    } as never);

    const context = await resolveClientEmailContextForClientAdvisorAssignment({
      clientUserId: "client-1",
      advisorProfileId: "advisor-1",
      advisorUser: { name: "Alex Advisor" },
    });

    expect(context?.isBranded).toBe(true);
    expect(context?.firmDisplayName).toBe("Independent Wealth Group");
    expect(context?.portalOrigin).toBe("https://independent-wealth.akilirisk.com");
    expect(context?.usesTenantHost).toBe(true);
  });

  it("returns platform origin when branding is disabled", async () => {
    vi.mocked(resolveAdvisorBrandingForProfile).mockResolvedValue(null);
    vi.mocked(prisma.advisorProfile.findUnique).mockResolvedValue({
      enterpriseId: null,
      subdomain: null,
    } as never);

    const context = await resolveClientEmailContextForClientAdvisorAssignment({
      clientUserId: "client-1",
      advisorProfileId: "advisor-1",
    });

    expect(context?.isBranded).toBe(false);
    expect(context?.portalOrigin).toBe("https://www.akilirisk.com");
    expect(context?.usesTenantHost).toBe(false);
  });
});
