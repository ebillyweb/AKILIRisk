import "server-only";

import {
  ADVISOR_BRANDING_PROFILE_SELECT,
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
};

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
 * Resolve branding for an advisor profile — enterprise canonical branding when
 * the profile belongs to a firm, otherwise the profile's own branding row.
 */
export async function resolveAdvisorBrandingForProfile(
  advisorProfileId: string
): Promise<AdvisorBrandingData | null> {
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

  const enterpriseId =
    profile.enterpriseId ??
    (
      await prisma.enterpriseMembership.findFirst({
        where: { advisorProfileId, status: "ACTIVE" },
        select: { enterpriseId: true },
      })
    )?.enterpriseId ??
    null;

  if (enterpriseId) {
    const enterpriseBranding = await getEnterpriseBrandingById(enterpriseId);
    if (enterpriseBranding) return enterpriseBranding;
  }

  if (!profile.brandingEnabled) return null;

  return mapAdvisorProfileToBrandingData(profile);
}
