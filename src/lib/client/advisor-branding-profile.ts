import "server-only";

import type {
  AdvisorBrandingData,
  LandingFeatureCard,
} from "@/lib/validation/branding";

export const ADVISOR_BRANDING_PROFILE_SELECT = {
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
  brandingEnabled: true,
  customDomainEnabled: true,
} as const;

type AdvisorBrandingProfileRow = {
  firmName: string | null;
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
};

export function mapAdvisorProfileToBrandingData(
  advisor: AdvisorBrandingProfileRow
): AdvisorBrandingData {
  return {
    brandName: advisor.brandName?.trim() || null,
    advisorFirmName: advisor.firmName?.trim() || null,
    tagline: advisor.tagline,
    landingKicker: advisor.landingKicker,
    landingHeadline: advisor.landingHeadline,
    landingSubheadline: advisor.landingSubheadline,
    landingSubtext: advisor.landingSubtext,
    landingFeatureCards:
      (advisor.landingFeatureCards as LandingFeatureCard[] | null) ?? null,
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
    customDomainEnabled: advisor.customDomainEnabled ?? false,
  };
}
