import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  advisorProfile: { findUnique: vi.fn() },
  enterpriseMembership: { findFirst: vi.fn() },
  advisorEnterprise: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));

import {
  hasConfiguredPersonalBrand,
  mapEnterpriseToBrandingData,
  resolveAdvisorBrandingForProfile,
} from "./branding";

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

describe("hasConfiguredPersonalBrand", () => {
  it("detects configured personal identity fields", () => {
    expect(
      hasConfiguredPersonalBrand({
        brandName: "Member Brand",
        tagline: null,
        primaryColor: null,
        logoUrl: null,
        logoS3Key: null,
      }),
    ).toBe(true);
    expect(
      hasConfiguredPersonalBrand({
        brandName: null,
        tagline: null,
        primaryColor: null,
        logoUrl: null,
        logoS3Key: null,
      }),
    ).toBe(false);
  });
});

const memberProfile = {
  enterpriseId: "ent-1",
  brandingEnabled: true,
  firmName: "Northbridge Elite",
  brandName: "Jordan Advisory",
  tagline: "Personal tagline",
  primaryColor: "#123456",
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
};

const enterpriseRow = {
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
  advisorMemberPersonalBrandingEnabled: false,
};

describe("resolveAdvisorBrandingForProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns enterprise branding for firm members without personal branding enabled", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      ...memberProfile,
      brandingEnabled: false,
    });
    prismaSpies.enterpriseMembership.findFirst.mockResolvedValue({
      enterpriseId: "ent-1",
      role: "ADVISOR",
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue(enterpriseRow);

    const branding = await resolveAdvisorBrandingForProfile("profile-member");

    expect(branding?.primaryColor).toBe("#e85d04");
    expect(branding?.brandName).toBe("Northbridge");
  });

  it("returns personal branding for assigned-client scope when firm allows it", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue(memberProfile);
    prismaSpies.enterpriseMembership.findFirst.mockResolvedValue({
      enterpriseId: "ent-1",
      role: "ADVISOR",
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      ...enterpriseRow,
      advisorMemberPersonalBrandingEnabled: true,
    });

    const branding = await resolveAdvisorBrandingForProfile("profile-member", {
      scope: "client",
    });

    expect(branding?.brandName).toBe("Jordan Advisory");
    expect(branding?.primaryColor).toBe("#123456");
  });

  it("falls back to firm branding when personal branding is allowed but unset", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue({
      ...memberProfile,
      brandName: null,
      tagline: null,
      primaryColor: null,
    });
    prismaSpies.enterpriseMembership.findFirst.mockResolvedValue({
      enterpriseId: "ent-1",
      role: "ADVISOR",
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      ...enterpriseRow,
      advisorMemberPersonalBrandingEnabled: true,
    });

    const branding = await resolveAdvisorBrandingForProfile("profile-member", {
      scope: "client",
    });

    expect(branding?.brandName).toBe("Northbridge");
    expect(branding?.primaryColor).toBe("#e85d04");
  });

  it("keeps firm branding for owners even on client scope", async () => {
    prismaSpies.advisorProfile.findUnique.mockResolvedValue(memberProfile);
    prismaSpies.enterpriseMembership.findFirst.mockResolvedValue({
      enterpriseId: "ent-1",
      role: "OWNER",
    });
    prismaSpies.advisorEnterprise.findUnique.mockResolvedValue({
      ...enterpriseRow,
      advisorMemberPersonalBrandingEnabled: true,
    });

    const branding = await resolveAdvisorBrandingForProfile("profile-member", {
      scope: "client",
    });

    expect(branding?.brandName).toBe("Northbridge");
  });
});
