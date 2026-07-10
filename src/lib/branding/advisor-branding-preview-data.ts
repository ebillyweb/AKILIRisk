import type { AdvisorBrandingData } from '@/lib/validation/branding';

/**
 * Normalize partial form values into {@link AdvisorBrandingData} for in-app previews.
 * Clears logoS3Key so same-origin advisor logo proxy paths work in settings UI.
 */
export function toAdvisorBrandingPreviewData(
  branding: Partial<AdvisorBrandingData>,
): AdvisorBrandingData {
  const brandName = branding.brandName?.trim() || '';

  return {
    brandingEnabled: true,
    customDomainEnabled: true,
    brandName,
    advisorFirmName: brandName,
    tagline: branding.tagline ?? null,
    landingKicker: branding.landingKicker ?? null,
    landingHeadline: branding.landingHeadline ?? null,
    landingSubheadline: branding.landingSubheadline ?? null,
    landingSubtext: branding.landingSubtext ?? null,
    landingFeatureCards: branding.landingFeatureCards ?? null,
    primaryColor: branding.primaryColor ?? null,
    secondaryColor: branding.secondaryColor ?? null,
    accentColor: branding.accentColor ?? null,
    websiteUrl: branding.websiteUrl ?? null,
    emailFooterText: branding.emailFooterText ?? null,
    supportEmail: branding.supportEmail ?? null,
    supportPhone: branding.supportPhone ?? null,
    logoUrl: branding.logoUrl ?? null,
    logoS3Key: null,
  };
}
