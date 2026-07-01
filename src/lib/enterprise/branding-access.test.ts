import { beforeEach, describe, expect, it, vi } from "vitest";

const billingContext = vi.hoisted(() => vi.fn());
const enterpriseFindUnique = vi.hoisted(() => vi.fn());
const brandingPolicyMock = vi.hoisted(() => vi.fn());
const advisorProfileFindUnique = vi.hoisted(() => vi.fn());
const resolveBranding = vi.hoisted(() => vi.fn());

vi.mock("@/lib/enterprise/billing-context", () => ({
  resolveBillingContext: billingContext,
}));
vi.mock("@/lib/enterprise/enterprise-member-branding-policy", () => ({
  getEnterpriseMemberBrandingPolicyForEnterprise: brandingPolicyMock,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    advisorEnterprise: { findUnique: enterpriseFindUnique },
    advisorProfile: { findUnique: advisorProfileFindUnique },
  },
}));
vi.mock("@/lib/enterprise/branding", () => ({
  resolveAdvisorBrandingForProfile: resolveBranding,
}));

import {
  assertCanMutateAdvisorBranding,
  assertCanMutateAdvisorSubdomain,
  isAdvisorBrandingReadOnly,
  isAdvisorSubdomainEditable,
  loadAdvisorBrandingSettingsView,
  resolveAdvisorBrandingSettingsContext,
} from "./branding-access";

describe("resolveAdvisorBrandingSettingsContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandingPolicyMock.mockResolvedValue({
      personalBranding: false,
      personalSubdomain: false,
    });
  });

  it("returns solo for advisors without an enterprise membership", async () => {
    billingContext.mockResolvedValue({
      kind: "solo",
      userId: "user-1",
      advisorProfileId: "profile-1",
      subscription: null,
    });

    await expect(resolveAdvisorBrandingSettingsContext("user-1")).resolves.toEqual({
      mode: "solo",
    });
  });

  it("returns enterprise-manage for firm owners", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "OWNER",
      advisorProfileId: "profile-1",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });

    await expect(resolveAdvisorBrandingSettingsContext("user-1")).resolves.toEqual({
      mode: "enterprise-manage",
      enterpriseId: "ent-1",
      enterpriseName: "Belvedere Wealth",
    });
  });

  it("returns enterprise-personal when firm allows personal branding", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });
    brandingPolicyMock.mockResolvedValue({
      personalBranding: true,
      personalSubdomain: true,
    });

    await expect(resolveAdvisorBrandingSettingsContext("user-2")).resolves.toEqual({
      mode: "enterprise-personal",
      enterpriseId: "ent-1",
      enterpriseName: "Belvedere Wealth",
      subdomainEditable: true,
    });
  });
});

describe("isAdvisorBrandingReadOnly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandingPolicyMock.mockResolvedValue({
      personalBranding: false,
      personalSubdomain: false,
    });
  });

  it("returns true for enterprise firm advisors", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });

    await expect(isAdvisorBrandingReadOnly("user-2")).resolves.toBe(true);
  });

  it("returns false for firm owners", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "OWNER",
      advisorProfileId: "profile-1",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });

    await expect(isAdvisorBrandingReadOnly("user-1")).resolves.toBe(false);
  });
});

describe("assertCanMutateAdvisorBranding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandingPolicyMock.mockResolvedValue({
      personalBranding: false,
      personalSubdomain: false,
    });
  });

  it("blocks branding mutations for enterprise advisors without personal branding", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });

    await expect(assertCanMutateAdvisorBranding("user-2")).rejects.toThrow(/read-only/i);
  });

  it("allows branding mutations when personal branding is enabled", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });
    brandingPolicyMock.mockResolvedValue({
      personalBranding: true,
      personalSubdomain: false,
    });

    await expect(assertCanMutateAdvisorBranding("user-2")).resolves.toBeUndefined();
  });
});

describe("isAdvisorSubdomainEditable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for enterprise advisors without subdomain permission", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });
    brandingPolicyMock.mockResolvedValue({
      personalBranding: true,
      personalSubdomain: false,
    });

    await expect(isAdvisorSubdomainEditable("user-2")).resolves.toBe(false);
  });
});

describe("assertCanMutateAdvisorSubdomain", () => {
  it("blocks subdomain changes when firm disables member subdomains", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });
    brandingPolicyMock.mockResolvedValue({
      personalBranding: true,
      personalSubdomain: false,
    });

    await expect(assertCanMutateAdvisorSubdomain("user-2")).rejects.toThrow(
      /subdomain management is disabled/i,
    );
  });
});

describe("loadAdvisorBrandingSettingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    brandingPolicyMock.mockResolvedValue({
      personalBranding: false,
      personalSubdomain: false,
    });
    advisorProfileFindUnique.mockResolvedValue({
      firmName: "Solo Firm",
      brandName: "Solo Firm",
      tagline: "Solo tagline",
      primaryColor: "#111111",
      secondaryColor: null,
      accentColor: null,
      websiteUrl: null,
      emailFooterText: null,
      supportEmail: null,
      supportPhone: null,
      logoUrl: null,
      logoS3Key: null,
      logoContentType: null,
      logoFileSize: null,
      logoUploadedAt: null,
    });
  });

  it("uses firm-resolved branding for read-only enterprise advisors", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });
    resolveBranding.mockResolvedValue({
      brandName: "Belvedere Wealth",
      advisorFirmName: "Belvedere Wealth",
      tagline: "Firm tagline",
      primaryColor: "#533483",
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

    const view = await loadAdvisorBrandingSettingsView("user-2", "profile-2");

    expect(view.readOnly).toBe(true);
    expect(view.profile.tagline).toBe("Firm tagline");
    expect(view.profile.primaryColor).toBe("#533483");
    expect(view.readOnlyNotice).toMatch(/Belvedere Wealth/i);
    expect(view.subdomainEditable).toBe(false);
  });

  it("loads editable personal branding for enterprise-personal members", async () => {
    billingContext.mockResolvedValue({
      kind: "enterprise",
      enterpriseId: "ent-1",
      role: "ADVISOR",
      advisorProfileId: "profile-2",
      subscription: null,
    });
    enterpriseFindUnique.mockResolvedValue({ name: "Belvedere Wealth" });
    brandingPolicyMock.mockResolvedValue({
      personalBranding: true,
      personalSubdomain: true,
    });

    const view = await loadAdvisorBrandingSettingsView("user-2", "profile-2");

    expect(view.readOnly).toBe(false);
    expect(view.profile.tagline).toBe("Solo tagline");
    expect(view.subdomainEditable).toBe(true);
    expect(resolveBranding).not.toHaveBeenCalled();
  });
});
