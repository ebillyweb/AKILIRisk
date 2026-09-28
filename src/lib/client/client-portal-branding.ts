import {
  looksLikeAdvisorBrandingS3Url,
  resolveBrandingLogoS3Key,
} from "@/lib/branding/advisor-logo-display";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export const CLIENT_ADVISOR_LOGO_PATH = "/api/client/advisor-logo";

/** Logo URL for `<img src>` in the client portal (S3 proxy or public HTTPS). */
export function clientPortalLogoImgSrc(branding: AdvisorBrandingData): string | null {
  // Private S3 objects cannot load in the browser — always proxy when we have a key
  // (including keys parsed from legacy logoUrl-only rows).
  if (resolveBrandingLogoS3Key(branding)) {
    return CLIENT_ADVISOR_LOGO_PATH;
  }
  const url = branding.logoUrl?.trim();
  if (!url?.startsWith("https://") || looksLikeAdvisorBrandingS3Url(url)) {
    return null;
  }
  return url;
}

/**
 * Header / portal display name — must match `(protected)/layout` `brandTitle`.
 *
 * Prefer **`advisorFirmName`** (live profile value) over **`brandName`** (the
 * legacy branding seed). `advisorFirmName` reflects the current firm name from
 * the advisor profile; `brandName` may be a stale value from initial setup.
 * Fall back to brandName when advisorFirmName is not set.
 */
export function clientPortalBrandingDisplayTitle(branding: AdvisorBrandingData): string {
  const firm = branding.advisorFirmName?.trim() ?? "";
  const brand = branding.brandName?.trim() ?? "";
  if (firm) return firm;
  if (brand) return brand;
  return "Partner portal";
}
