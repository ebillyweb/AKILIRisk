import "server-only";

import {
  mapAdvisorProfileToBrandingData,
} from "@/lib/client/advisor-branding-profile";
import { prisma } from "@/lib/db";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export const ENTERPRISE_BRANDING_SELECT = {
  name: true,
  brandName: true,
  tagline: true,
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
    brandName: branding.brandName,
    tagline: branding.tagline,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    accentColor: branding.accentColor,
    logoUrl: branding.logoUrl,
    logoS3Key: branding.logoS3Key,
    websiteUrl: branding.websiteUrl,
    emailFooterText: branding.emailFooterText,
    supportEmail: branding.supportEmail,
    supportPhone: branding.supportPhone,
    brandingEnabled: branding.brandingEnabled ?? true,
  };
}