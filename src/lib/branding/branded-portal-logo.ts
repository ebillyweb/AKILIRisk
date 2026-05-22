import {
  looksLikeAdvisorBrandingS3Url,
  resolveBrandingLogoS3Key,
} from '@/lib/branding/advisor-logo-display';

/** Same-origin logo stream for unauthenticated branded subdomain pages. */
export const BRANDED_ADVISOR_LOGO_PATH = '/api/branded/advisor-logo';

/**
 * Resolves logo src for img tags on tenant hosts (e.g. ebilly-staging.akilirisk.com).
 * Private S3 URLs in logoUrl cannot load in the browser — use the branded API route.
 */
export function brandedPortalLogoImgSrc(branding: {
  logoS3Key?: string | null;
  logoUrl?: string | null;
}): string | null {
  if (!resolveBrandingLogoS3Key(branding)) {
    const url = branding.logoUrl?.trim();
    if (!url?.startsWith('https://') || looksLikeAdvisorBrandingS3Url(url)) {
      return null;
    }
    return url;
  }

  return BRANDED_ADVISOR_LOGO_PATH;
}
