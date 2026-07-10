import "server-only";

import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import {
  resolveAdvisorBrandingForProfile,
} from "@/lib/enterprise/branding";
import { getEnterpriseMemberBrandingPolicyForEnterprise } from "@/lib/enterprise/enterprise-member-branding-policy";
import type { AdvisorBrandingData } from "@/lib/validation/branding";
import { prisma } from "@/lib/db";

export type AdvisorBrandingSettingsContext =
  | { mode: "solo" }
  | {
      mode: "enterprise-manage";
      enterpriseId: string;
      enterpriseName: string;
    }
  | {
      mode: "enterprise-view";
      enterpriseId: string;
      enterpriseName: string;
    }
  | {
      mode: "enterprise-personal";
      enterpriseId: string;
      enterpriseName: string;
      subdomainEditable: boolean;
    };

export type BrandingSettingsProfile = {
  firmName?: string | null;
  brandName?: string | null;
  tagline?: string | null;
  landingKicker?: string | null;
  landingHeadline?: string | null;
  landingSubheadline?: string | null;
  landingSubtext?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  websiteUrl?: string | null;
  emailFooterText?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  logoUrl?: string | null;
  logoS3Key?: string | null;
  logoContentType?: string | null;
  logoFileSize?: number | null;
  logoUploadedAt?: Date | null;
  /** Raw stored cards (JSON); the form normalizes via resolveLandingFeatureCards. */
  landingFeatureCards?: unknown;
};

export type AdvisorBrandingSettingsView = {
  context: AdvisorBrandingSettingsContext;
  profile: BrandingSettingsProfile;
  readOnly: boolean;
  readOnlyNotice?: string;
  /** When false, hide subdomain management even if branding is editable. */
  subdomainEditable: boolean;
  /** When false, the Branding settings tab is omitted (enterprise members without personal branding). */
  brandingTabVisible: boolean;
};

function mapResolvedBrandingToProfile(
  branding: AdvisorBrandingData,
): BrandingSettingsProfile {
  return {
    firmName: branding.advisorFirmName ?? branding.brandName,
    brandName: branding.brandName,
    tagline: branding.tagline,
    landingKicker: branding.landingKicker,
    landingHeadline: branding.landingHeadline,
    landingSubheadline: branding.landingSubheadline,
    landingSubtext: branding.landingSubtext,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    websiteUrl: branding.websiteUrl,
    emailFooterText: branding.emailFooterText,
    supportEmail: branding.supportEmail,
    supportPhone: branding.supportPhone,
    logoUrl: branding.logoUrl,
    logoS3Key: branding.logoS3Key,
    logoContentType: branding.logoContentType,
    logoFileSize: branding.logoFileSize,
    logoUploadedAt: branding.logoUploadedAt,
    landingFeatureCards: branding.landingFeatureCards ?? null,
  };
}

export async function resolveAdvisorBrandingSettingsContext(
  userId: string,
): Promise<AdvisorBrandingSettingsContext> {
  const ctx = await resolveBillingContext(userId);
  if (!ctx || ctx.kind !== "enterprise") {
    return { mode: "solo" };
  }

  const [enterprise, brandingPolicy] = await Promise.all([
    prisma.advisorEnterprise.findUnique({
      where: { id: ctx.enterpriseId },
      select: { name: true },
    }),
    getEnterpriseMemberBrandingPolicyForEnterprise(ctx.enterpriseId),
  ]);

  if (!enterprise) {
    return { mode: "solo" };
  }

  if (ctx.role === "OWNER" || ctx.role === "ADMIN") {
    return {
      mode: "enterprise-manage",
      enterpriseId: ctx.enterpriseId,
      enterpriseName: enterprise.name,
    };
  }

  if (brandingPolicy.personalBranding) {
    return {
      mode: "enterprise-personal",
      enterpriseId: ctx.enterpriseId,
      enterpriseName: enterprise.name,
      subdomainEditable: brandingPolicy.personalSubdomain,
    };
  }

  return {
    mode: "enterprise-view",
    enterpriseId: ctx.enterpriseId,
    enterpriseName: enterprise.name,
  };
}

export async function isAdvisorBrandingReadOnly(userId: string): Promise<boolean> {
  const context = await resolveAdvisorBrandingSettingsContext(userId);
  return context.mode === "enterprise-view";
}

export async function isAdvisorSubdomainEditable(userId: string): Promise<boolean> {
  const context = await resolveAdvisorBrandingSettingsContext(userId);
  if (context.mode === "solo" || context.mode === "enterprise-manage") {
    return true;
  }
  if (context.mode === "enterprise-personal") {
    return context.subdomainEditable;
  }
  return false;
}

export async function assertCanMutateAdvisorBranding(userId: string): Promise<void> {
  if (await isAdvisorBrandingReadOnly(userId)) {
    throw new Error(
      "Firm branding is read-only for your role. Contact a firm owner or administrator to request changes.",
    );
  }
}

export async function assertCanMutateAdvisorSubdomain(userId: string): Promise<void> {
  if (!(await isAdvisorSubdomainEditable(userId))) {
    throw new Error(
      "Subdomain management is disabled for your role. Contact a firm owner or administrator to enable it.",
    );
  }
}

export async function loadAdvisorBrandingSettingsView(
  userId: string,
  advisorProfileId: string,
): Promise<AdvisorBrandingSettingsView> {
  const context = await resolveAdvisorBrandingSettingsContext(userId);

  const advisorProfile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      firmName: true,
      brandName: true,
      tagline: true,
      landingKicker: true,
      landingHeadline: true,
      landingSubheadline: true,
      landingSubtext: true,
      landingFeatureCards: true,
      primaryColor: true,
      secondaryColor: true,
      accentColor: true,
      websiteUrl: true,
      emailFooterText: true,
      supportEmail: true,
      supportPhone: true,
      logoUrl: true,
      logoS3Key: true,
      logoContentType: true,
      logoFileSize: true,
      logoUploadedAt: true,
    },
  });

  if (!advisorProfile) {
    throw new Error("Advisor profile not found");
  }

  const baseProfile: BrandingSettingsProfile = advisorProfile;

  if (context.mode === "solo") {
    return {
      context,
      profile: baseProfile,
      readOnly: false,
      subdomainEditable: true,
      brandingTabVisible: true,
    };
  }

  if (context.mode === "enterprise-personal") {
    return {
      context,
      profile: baseProfile,
      readOnly: false,
      subdomainEditable: context.subdomainEditable,
      brandingTabVisible: true,
    };
  }

  if (context.mode === "enterprise-view") {
    return {
      context,
      profile: baseProfile,
      readOnly: true,
      subdomainEditable: false,
      brandingTabVisible: false,
    };
  }

  const resolved = await resolveAdvisorBrandingForProfile(advisorProfileId);
  const profile = resolved ? mapResolvedBrandingToProfile(resolved) : baseProfile;

  return {
    context,
    profile,
    readOnly: false,
    subdomainEditable: true,
    brandingTabVisible: true,
  };
}
