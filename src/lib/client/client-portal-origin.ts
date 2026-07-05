import "server-only";

import {
  buildAdvisorPortalHostname,
  getProductionDomain,
  toTenantHostLabel,
} from "@/lib/advisor/platform-subdomain";
import {
  buildStagingTenantPortalUrl,
  usesStagingTenantPathPortals,
} from "@/lib/advisor/tenant-path-portals";

/** Public origin for an advisor tenant host (path portals or subdomain). */
export function buildAdvisorPortalOrigin(canonicalSlug: string): string {
  if (usesStagingTenantPathPortals()) {
    return buildStagingTenantPortalUrl(canonicalSlug);
  }

  const domain = getProductionDomain();
  if (!domain) {
    const port = process.env.PORT?.trim() || "3000";
    const label = toTenantHostLabel(canonicalSlug);
    return `http://${label}.localhost:${port}`;
  }
  return `https://${buildAdvisorPortalHostname(canonicalSlug)}`;
}
