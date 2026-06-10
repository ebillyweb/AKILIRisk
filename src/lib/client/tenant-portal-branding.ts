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

  const branding = await getAdvisorBrandingBySubdomain(subdomain);
  if (!branding?.brandingEnabled) {
    return null;
  }

  return branding;
}
