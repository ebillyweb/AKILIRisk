import "server-only";

import {
  mapAdvisorProfileToBrandingData,
} from "@/lib/client/advisor-branding-profile";
import { prisma } from "@/lib/db";
import type {
  AdvisorBrandingData,
  LandingFeatureCard,
} from "@/lib/validation/branding";

export const ENTERPRISE_BRANDING_SELECT = {
  name: true,
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
  logoUrl: true,
  logoS3Key: true,
  logoContentType: true,
  logoFileSize: true,
  logoUploadedAt: true,
  websiteUrl: true,
  emailFooterText: true,
  supportEmail: true,
  supportPhone: true,
  brandingEnabled: true,
  customDomainEnabled: true,
  advisorMemberPersonalBrandingEnabled: true,
} as const;

type EnterpriseBrandingRow = {
  name: string;
  brandName: string | null;
  tagline: string | null;
  landingKicker: string | null;
  landingHeadline: string | null;
  landingSubheadline: string | null;
  landingSubtext: string | null;
  landingFeatureCards: unknown;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  logoS3Key: string | null;
  logoContentType: string | null;
  logoFileSize: number | null;
  logoUploadedAt: Date | null;
  websiteUrl: string | null;
  emailFooterText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  brandingEnabled: boolean;
  customDomainEnabled: boolean;
  advisorMemberPersonalBrandingEnabled?: boolean;
};

type AdvisorBrandingProfileFields = {
  brandingEnabled: boolean;
  firmName: string | null;
  brandName: string | null;
  tagline: string | null;
  landingKicker: string | null;
  landingHeadline: string | null;
  landingSubheadline: string | null;
  landingSubtext: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  logoS3Key: string | null;
  logoContentType: string | null;
  logoFileSize: number | null;
  logoUploadedAt: Date | null;
  websiteUrl: string | null;
  emailFooterText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  customDomainEnabled: boolean;
};

/** `firm` = canonical enterprise branding; `client` = assigned-client surfaces. */
export type AdvisorBrandingResolveScope = "firm" | "client";

export function hasConfiguredPersonalBrand(
  profile: Pick<
    AdvisorBrandingProfileFields,
    "brandName" | "tagline" | "primaryColor" | "logoUrl" | "logoS3Key"
  >,
): boolean {
  return Boolean(
    profile.brandName?.trim() ||
      profile.tagline?.trim() ||
      profile.primaryColor?.trim() ||
      profile.logoUrl?.trim() ||
      profile.logoS3Key?.trim(),
  );
}

export function mapEnterpriseToBrandingData(
  enterprise: EnterpriseBrandingRow
): AdvisorBrandingData {
  return {
    brandName: enterprise.brandName?.trim() || enterprise.name.trim() || null,
    advisorFirmName: enterprise.name.trim() || null,
    tagline: enterprise.tagline,
    landingKicker: enterprise.landingKicker,
    landingHeadline: enterprise.landingHeadline,
    landingSubheadline: enterprise.landingSubheadline,
    landingSubtext: enterprise.landingSubtext,
    landingFeatureCards:
      (enterprise.landingFeatureCards as LandingFeatureCard[] | null) ?? null,
    primaryColor: enterprise.primaryColor,
    secondaryColor: enterprise.secondaryColor,
    accentColor: enterprise.accentColor,
    logoUrl: enterprise.logoUrl,
    logoS3Key: enterprise.logoS3Key,
    logoContentType: enterprise.logoContentType,
    logoFileSize: enterprise.logoFileSize,
    logoUploadedAt: enterprise.logoUploadedAt,
    websiteUrl: enterprise.websiteUrl,
    emailFooterText: enterprise.emailFooterText,
    supportEmail: enterprise.supportEmail,
    supportPhone: enterprise.supportPhone,
    brandingEnabled: enterprise.brandingEnabled,
    customDomainEnabled: enterprise.customDomainEnabled ?? false,
  };
}

export async function getEnterpriseBrandingById(
  enterpriseId: string
): Promise<AdvisorBrandingData | null> {
  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: ENTERPRISE_BRANDING_SELECT,
  });
  if (!enterprise?.brandingEnabled) return null;
  return mapEnterpriseToBrandingData(enterprise);
}

/**
 * Resolve branding for an advisor profile. Enterprise members use firm branding
 * by default; with `scope: "client"` and firm policy enabled, ADVISOR-role members
 * expose personal branding to their assigned clients.
 */
export async function resolveAdvisorBrandingForProfile(
  advisorProfileId: string,
  options?: { scope?: AdvisorBrandingResolveScope },
): Promise<AdvisorBrandingData | null> {
  const scope = options?.scope ?? "firm";

  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      enterpriseId: true,
      brandingEnabled: true,
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
      logoUrl: true,
      logoS3Key: true,
      logoContentType: true,
      logoFileSize: true,
      logoUploadedAt: true,
      websiteUrl: true,
      emailFooterText: true,
      supportEmail: true,
      supportPhone: true,
      customDomainEnabled: true,
    },
  });
  if (!profile) return null;

  const membership = await prisma.enterpriseMembership.findFirst({
    where: { advisorProfileId, status: "ACTIVE" },
    select: { enterpriseId: true, role: true },
  });

  const enterpriseId = profile.enterpriseId ?? membership?.enterpriseId ?? null;

  if (!enterpriseId) {
    if (!profile.brandingEnabled) return null;
    return mapAdvisorProfileToBrandingData(profile);
  }

  const enterprise = await prisma.advisorEnterprise.findUnique({
    where: { id: enterpriseId },
    select: ENTERPRISE_BRANDING_SELECT,
  });

  const enterpriseBranding =
    enterprise?.brandingEnabled && enterprise
      ? mapEnterpriseToBrandingData(enterprise)
      : null;

  const usePersonalBranding =
    scope === "client" &&
    membership?.role === "ADVISOR" &&
    enterprise?.advisorMemberPersonalBrandingEnabled === true &&
    profile.brandingEnabled;

  if (usePersonalBranding) {
    if (hasConfiguredPersonalBrand(profile)) {
      return mapAdvisorProfileToBrandingData(profile);
    }
    return enterpriseBranding;
  }

  if (enterpriseBranding) return enterpriseBranding;

  if (!profile.brandingEnabled) return null;
  return mapAdvisorProfileToBrandingData(profile);
}

export function mapResolvedBrandingToInvitationProfile(
  branding: AdvisorBrandingData,
  fallbackFirmName: string | null,
): {
  firmName: string | null;
  brandName: string | null;
  tagline: string | null;
  landingKicker: string | null;
  landingHeadline: string | null;
  landingSubheadline: string | null;
  landingSubtext: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  logoUrl: string | null;
  logoS3Key: string | null;
  websiteUrl: string | null;
  emailFooterText: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  brandingEnabled: boolean;
} {
  return {
    firmName: branding.advisorFirmName ?? fallbackFirmName,
    brandName: branding.brandName ?? null,
    tagline: branding.tagline ?? null,
    landingKicker: branding.landingKicker ?? null,
    landingHeadline: branding.landingHeadline ?? null,
    landingSubheadline: branding.landingSubheadline ?? null,
    landingSubtext: branding.landingSubtext ?? null,
    primaryColor: branding.primaryColor ?? null,
    secondaryColor: branding.secondaryColor ?? null,
    accentColor: branding.accentColor ?? null,
    logoUrl: branding.logoUrl ?? null,
    logoS3Key: branding.logoS3Key ?? null,
    websiteUrl: branding.websiteUrl ?? null,
    emailFooterText: branding.emailFooterText ?? null,
    supportEmail: branding.supportEmail ?? null,
    supportPhone: branding.supportPhone ?? null,
    brandingEnabled: branding.brandingEnabled ?? true,
  };
}