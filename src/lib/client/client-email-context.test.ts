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
    enterpriseMembership: {
      findFirst: vi.fn(),
    },
    advisorEnterprise: {
      findUnique: vi.fn(),
    },
  },
}));

// Keep the real pure helpers (ENTERPRISE_BRANDING_SELECT, hasConfiguredPersonalBrand,
// mapEnterpriseToBrandingData); only stub the DB-backed resolver.
vi.mock("@/lib/enterprise/branding", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/enterprise/branding")>()),
  resolveAdvisorBrandingForProfile: vi.fn(),
}));

vi.mock("@/lib/subscription/validation", () => ({
  getSubscriptionFeatures: vi.fn(),
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
import { getSubscriptionFeatures } from "@/lib/subscription/validation";

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
    vi.mocked(prisma.enterpriseMembership.findFirst).mockReset();
    vi.mocked(prisma.advisorEnterprise.findUnique).mockReset();
    vi.mocked(resolveAdvisorBrandingForProfile).mockReset();
    vi.mocked(getSubscriptionFeatures).mockReset();
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

  it("returns platform origin when branding is off and advisor is not entitled", async () => {
    vi.mocked(resolveAdvisorBrandingForProfile).mockResolvedValue(null);
    vi.mocked(prisma.advisorProfile.findUnique).mockResolvedValue({
      userId: "user-1",
      enterpriseId: null,
      subdomain: null,
      brandName: "Solo Brand",
      primaryColor: "#123456",
    } as never);
    vi.mocked(prisma.enterpriseMembership.findFirst).mockResolvedValue(null as never);
    // Not entitled → stays on the generic platform template even with assets.
    vi.mocked(getSubscriptionFeatures).mockResolvedValue(null);

    const context = await resolveClientEmailContextForClientAdvisorAssignment({
      clientUserId: "client-1",
      advisorProfileId: "advisor-1",
    });

    expect(context?.isBranded).toBe(false);
    expect(context?.portalOrigin).toBe("https://www.akilirisk.com");
    expect(context?.usesTenantHost).toBe(false);
  });

  it("white-labels when the branding toggle is off but the firm is entitled and has assets", async () => {
    vi.mocked(resolveAdvisorBrandingForProfile).mockResolvedValue(null);
    vi.mocked(prisma.advisorProfile.findUnique).mockResolvedValue({
      userId: "user-1",
      enterpriseId: "ent-1",
      subdomain: null,
      brandName: null,
      primaryColor: null,
      logoUrl: null,
      logoS3Key: null,
    } as never);
    vi.mocked(prisma.enterpriseMembership.findFirst).mockResolvedValue({
      enterpriseId: "ent-1",
      role: "OWNER",
    } as never);
    vi.mocked(getSubscriptionFeatures).mockResolvedValue({
      tier: "PROFESSIONAL",
      basicBrandingEnabled: true,
      advancedBrandingEnabled: true,
      customSubdomainEnabled: true,
      whiteLabel: true,
    });
    vi.mocked(prisma.advisorEnterprise.findUnique).mockResolvedValue({
      name: "Belvedere Wealth",
      brandName: null,
      tagline: null,
      landingKicker: null,
      landingHeadline: null,
      landingSubheadline: null,
      landingSubtext: null,
      primaryColor: "#0f172a",
      secondaryColor: null,
      accentColor: null,
      logoUrl: null,
      logoS3Key: null,
      logoContentType: null,
      logoFileSize: null,
      logoUploadedAt: null,
      websiteUrl: null,
      emailFooterText: null,
      supportEmail: null,
      supportPhone: null,
      brandingEnabled: false,
      customDomainEnabled: false,
      advisorMemberPersonalBrandingEnabled: false,
    } as never);
    vi.mocked(prisma.advisorSubdomain.findFirst).mockResolvedValue(null as never);

    const context = await resolveClientEmailContextForClientAdvisorAssignment({
      clientUserId: "client-1",
      advisorProfileId: "advisor-1",
    });

    expect(context?.isBranded).toBe(true);
    expect(context?.firmDisplayName).toBe("Belvedere Wealth");
  });
});
