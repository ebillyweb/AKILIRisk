import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaSpies = vi.hoisted(() => ({
  clientAdvisorAssignment: {
    findFirst: vi.fn(),
  },
  advisorProfile: {
    findUnique: vi.fn(),
  },
  enterpriseMembership: {
    findFirst: vi.fn(),
  },
  inviteCode: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

const headersMock = vi.hoisted(() => vi.fn());
const userEmailForDisplayMock = vi.hoisted(() => vi.fn());
const tenantBrandingMock = vi.hoisted(() => vi.fn(async () => null as ReturnType<typeof mapAdvisorProfileToBrandingData> | null));
const isTenantBrandedRequestMock = vi.hoisted(() => vi.fn(async () => false));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("next/headers", () => ({
  headers: headersMock,
}));
vi.mock("@/lib/client/branded-portal-requirements", () => ({
  isTenantBrandedRequest: isTenantBrandedRequestMock,
}));
vi.mock("@/lib/client/tenant-portal-branding", () => ({
  getTenantBrandingFromRequestHeaders: tenantBrandingMock,
}));
vi.mock("@/lib/auth/user-email", () => ({
  userEmailForDisplay: (...args: unknown[]) => userEmailForDisplayMock(...args),
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
    isTenantBrandedRequestMock.mockResolvedValue(false);
    tenantBrandingMock.mockResolvedValue(null);
    userEmailForDisplayMock.mockReturnValue("");
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);
    prismaSpies.enterpriseMembership.findFirst.mockResolvedValue(null);
    prismaSpies.inviteCode.findFirst.mockResolvedValue(null);
    prismaSpies.user.findUnique.mockResolvedValue(null);
  });

  it("prefers assignment branding and resolves the logo URL", async () => {
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValueOnce({
      advisorId: "adv-1",
    });
    prismaSpies.advisorProfile.findUnique.mockResolvedValueOnce(brandedAdvisor);

    const branding = await resolveClientPortalBrandingForUser({
      userId: "client-1",
      email: "client@example.com",
    });

    expect(branding?.advisorFirmName).toBe("eBilly's WebSolutions");
    expect(branding?.logoUrl).toBe("/api/client/advisor-logo");
  });

  it("prefers tenant branding on tenant host before assignment", async () => {
    isTenantBrandedRequestMock.mockResolvedValueOnce(true);

    const tenantAdvisor = {
      ...brandedAdvisor,
      brandName: "Tenant Brand",
      primaryColor: "#abcdef",
    };

    tenantBrandingMock.mockResolvedValueOnce(
      mapAdvisorProfileToBrandingData(tenantAdvisor)
    );
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValueOnce({
      advisorId: "adv-1",
    });
    prismaSpies.advisorProfile.findUnique.mockResolvedValueOnce(brandedAdvisor);
    prismaSpies.inviteCode.findFirst.mockResolvedValueOnce(null);

    const branding = await resolveClientPortalBrandingForUser({
      userId: "client-1",
      email: "client@example.com",
    });

    expect(branding?.primaryColor).toBe("#abcdef");
    expect(branding?.logoUrl).toBe("/api/branded/advisor-logo");
  });

  it("falls back to the inviting advisor, scoped to an active assignment", async () => {
    prismaSpies.inviteCode.findFirst.mockResolvedValueOnce({
      advisor: brandedAdvisor,
    });

    const branding = await resolveClientPortalBrandingForUser({
      userId: "client-1",
      email: "invited@example.com",
    });

    expect(branding?.primaryColor).toBe("#112233");
    // SECURITY: the invite-branding query must require the inviting advisor to
    // hold an ACTIVE assignment to this client — `prefillEmail` alone is
    // attacker-controlled. Guards against the cross-tenant branding hijack.
    expect(prismaSpies.inviteCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prefillEmail: { equals: "invited@example.com", mode: "insensitive" },
          advisor: expect.objectContaining({
            brandingEnabled: true,
            clientAssignments: {
              some: { clientId: "client-1", status: "ACTIVE" },
            },
          }),
        }),
      })
    );
  });

  it("loads client email from the database when the session email is missing", async () => {
    prismaSpies.user.findUnique.mockResolvedValueOnce({
      emailCiphertext: "cipher-invited@example.com",
    });
    userEmailForDisplayMock.mockReturnValueOnce("invited@example.com");
    prismaSpies.inviteCode.findFirst.mockResolvedValueOnce({
      advisor: brandedAdvisor,
    });

    const branding = await resolveClientPortalBrandingForUser({
      userId: "client-1",
      email: "",
    });

    expect(branding?.primaryColor).toBe("#112233");
    expect(prismaSpies.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "client-1" } })
    );
    expect(prismaSpies.inviteCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          prefillEmail: { equals: "invited@example.com", mode: "insensitive" },
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
