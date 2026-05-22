import "server-only";

import { headers } from "next/headers";
import { getAdvisorBrandingBySubdomain } from "@/lib/advisor/subdomain";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

/**
 * Branding for clients browsing on an advisor tenant host (subdomain).
 * Used when the proxy sets x-branded-mode / x-subdomain but the user is not
 * yet on a route wrapped by the /branded layout.
 */
export async function getTenantBrandingFromRequestHeaders(): Promise<AdvisorBrandingData | null> {
  const headersList = await headers();
  if (headersList.get("x-branded-mode") !== "true") {
    return null;
  }

  const subdomain = headersList.get("x-subdomain");
  if (!subdomain) {
    return null;
  }

  const row = await getAdvisorBrandingBySubdomain(subdomain);
  if (!row?.brandingEnabled) {
    return null;
  }

  return {
    brandName: row.brandName?.trim() || null,
    advisorFirmName: row.brandName?.trim() || null,
    tagline: row.tagline,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    logoUrl: row.logoUrl,
    logoS3Key: row.logoS3Key,
    logoContentType: null,
    logoFileSize: null,
    logoUploadedAt: null,
    websiteUrl: row.websiteUrl,
    emailFooterText: row.emailFooterText,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    brandingEnabled: row.brandingEnabled,
    customDomainEnabled: row.customDomainEnabled ?? false,
  };
}
