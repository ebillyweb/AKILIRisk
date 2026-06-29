import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorProfile: { findUnique: vi.fn() },
  enterpriseMembership: { findFirst: vi.fn() },
  advisorEnterprise: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import { mapEnterpriseToBrandingData, resolveAdvisorBrandingForProfile } from "./branding";

describe("mapEnterpriseToBrandingData", () => {
  it("uses enterprise name when brandName is unset", () => {
    const branding = mapEnterpriseToBrandingData({
      name: "Acme Wealth",
      brandName: null,
      tagline: null,
      primaryColor: "#111111",
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
      brandingEnabled: true,
      customDomainEnabled: false,
    });

    expect(branding.brandName).toBe("Acme Wealth");
    expect(branding.advisorFirmName).toBe("Acme Wealth");
  });
});

describe("resolveAdvisorBrandingForProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns enterprise branding for firm members without personal branding enabled", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      enterpriseId: "ent-1",
      brandingEnabled: false,
      firmName: "Northbridge Elite",
      brandName: null,
      tagline: null,
      primaryColor: null,
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
      customDomainEnabled: false,
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      name: "Northbridge Elite",
      brandName: "Northbridge",
      tagline: null,
      primaryColor: "#e85d04",
      secondaryColor: "#7b2cbf",
      accentColor: null,
      logoUrl: "https://cdn.example.com/logo.png",
      logoS3Key: null,
      logoContentType: null,
      logoFileSize: null,
      logoUploadedAt: null,
      websiteUrl: null,
      emailFooterText: null,
      supportEmail: null,
      supportPhone: null,
      brandingEnabled: true,
      customDomainEnabled: false,
    });

    const branding = await resolveAdvisorBrandingForProfile("profile-member");

    expect(branding?.primaryColor).toBe("#e85d04");
    expect(branding?.brandName).toBe("Northbridge");
    expect(prismaSpies.enterpriseMembership.findFirst).not.toHaveBeenCalled();
  });
});
