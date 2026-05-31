import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvitationStatus } from "@prisma/client";

const prismaSpies = vi.hoisted(() => ({
  clientAdvisorAssignment: {
    findFirst: vi.fn(),
  },
  inviteCode: {
    findFirst: vi.fn(),
  },
}));

const headersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("next/headers", () => ({
  headers: headersMock,
}));

import {
  resolveClientPortalBrandingForUser,
  withClientPortalLogoSrc,
} from "./resolve-client-portal-branding";

const brandedAdvisor = {
  firmName: "eBilly's WebSolutions",
  brandName: "eBilly's WebSolutions",
  tagline: "Tagline",
  primaryColor: "#112233",
  secondaryColor: "#ddeeff",
  accentColor: "#445566",
  logoUrl: "https://akili-advisor-assets.s3.us-east-2.amazonaws.com/advisors/a/logos/logo.png",
  logoS3Key: "advisors/a/logos/logo.png",
  logoContentType: "image/png",
  logoFileSize: 100,
  logoUploadedAt: new Date(),
  websiteUrl: null,
  emailFooterText: null,
  supportEmail: null,
  supportPhone: null,
  brandingEnabled: true,
  customDomainEnabled: false,
};

describe("withClientPortalLogoSrc", () => {
  it("uses the client logo API for assignment branding", () => {
    const resolved = withClientPortalLogoSrc(
      mapAdvisorProfileToBrandingData(brandedAdvisor)
    );
    expect(resolved.logoUrl).toBe("/api/client/advisor-logo");
  });

  it("uses the branded tenant logo API when requested", () => {
    const resolved = withClientPortalLogoSrc(
      mapAdvisorProfileToBrandingData(brandedAdvisor),
      true
    );
    expect(resolved.logoUrl).toBe("/api/branded/advisor-logo");
  });
});

describe("resolveClientPortalBrandingForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers());
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);
    prismaSpies.inviteCode.findFirst.mockResolvedValue(null);
  });

  it("prefers assignment branding and resolves the logo URL", async () => {
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValueOnce({
      advisor: brandedAdvisor,
    });

    const branding = await resolveClientPortalBrandingForUser({
      userId: "client-1",
      email: "client@example.com",
    });

    expect(branding?.advisorFirmName).toBe("eBilly's WebSolutions");
    expect(branding?.logoUrl).toBe("/api/client/advisor-logo");
    expect(prismaSpies.inviteCode.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to the inviting advisor when no assignment exists yet", async () => {
    prismaSpies.inviteCode.findFirst.mockResolvedValueOnce({
      advisor: brandedAdvisor,
    });

    const branding = await resolveClientPortalBrandingForUser({
      userId: "client-1",
      email: "invited@example.com",
    });

    expect(branding?.primaryColor).toBe("#112233");
    expect(prismaSpies.inviteCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prefillEmail: "invited@example.com",
          status: {
            in: [
              InvitationStatus.SENT,
              InvitationStatus.OPENED,
              InvitationStatus.REGISTERED,
            ],
          },
        }),
      })
    );
  });
});

function mapAdvisorProfileToBrandingData(advisor: typeof brandedAdvisor) {
  return {
    brandName: advisor.brandName,
    advisorFirmName: advisor.firmName,
    tagline: advisor.tagline,
    primaryColor: advisor.primaryColor,
    secondaryColor: advisor.secondaryColor,
    accentColor: advisor.accentColor,
    logoUrl: advisor.logoUrl,
    logoS3Key: advisor.logoS3Key,
    logoContentType: advisor.logoContentType,
    logoFileSize: advisor.logoFileSize,
    logoUploadedAt: advisor.logoUploadedAt,
    websiteUrl: advisor.websiteUrl,
    emailFooterText: advisor.emailFooterText,
    supportEmail: advisor.supportEmail,
    supportPhone: advisor.supportPhone,
    brandingEnabled: advisor.brandingEnabled,
    customDomainEnabled: advisor.customDomainEnabled,
  };
}
