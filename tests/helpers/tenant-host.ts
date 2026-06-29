import { expect } from "@playwright/test";

import {
  buildStagingTenantPortalUrl,
  usesStagingTenantPathPortals,
} from "@/lib/advisor/tenant-path-portals";

/** Matches staging tenant portal URLs on preview.akilirisk.com/t/{slug}. */
export function usesTenantPathPortals(): boolean {
  const explicit = process.env.TENANT_PATH_PORTALS?.trim().toLowerCase();
  if (explicit === "false") return false;
  if (explicit === "true") return true;
  return usesStagingTenantPathPortals();
}

/** @deprecated Hostname suffix staging; use path portals when TENANT_PATH_PORTALS is enabled. */
export const TENANT_SUBDOMAIN_SUFFIX = process.env.TENANT_SUBDOMAIN_SUFFIX ?? "";

export function tenantPortalUrl(slug: string): string {
  if (usesTenantPathPortals()) {
    const domain = process.env.PRODUCTION_DOMAIN ?? "akilirisk.com";
    process.env.PRODUCTION_DOMAIN = domain;
    return `${buildStagingTenantPortalUrl(slug)}/`;
  }
  return `https://${slug}${TENANT_SUBDOMAIN_SUFFIX}.akilirisk.com/`;
}

export function tenantHostOrigin(slug: string): string {
  return tenantPortalUrl(slug).replace(/\/$/, "");
}

/** Assert invite API returned a signup URL on the advisor tenant host (not platform preview). */
export function expectTenantInvitationUrl(url: string, slug: string): void {
  const origin = tenantHostOrigin(slug);
  expect(url.startsWith(`${origin}/signup?`), `expected tenant invite URL under ${origin}`).toBe(
    true
  );
}

/** Tenant slug for advisor2@test.com (seed-advisor-test-data.js). */
export const ADVISOR2_TENANT_SLUG = "independent-wealth";

export function expectOnTenantHost(
  pageUrl: string,
  slug: string = ADVISOR2_TENANT_SLUG
): void {
  if (usesTenantPathPortals()) {
    expect(pageUrl).toContain(`/t/${slug}`);
    return;
  }
  const host = `${slug}${TENANT_SUBDOMAIN_SUFFIX}.akilirisk.com`;
  expect(pageUrl).toContain(host);
}
