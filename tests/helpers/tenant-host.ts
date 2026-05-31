import { expect } from "@playwright/test";

/** Matches `subdomain-routing.spec.ts` / Vercel Preview tenant hosts. */
export const TENANT_SUBDOMAIN_SUFFIX = process.env.TENANT_SUBDOMAIN_SUFFIX ?? "";

export function tenantHostOrigin(slug: string): string {
  return `https://${slug}${TENANT_SUBDOMAIN_SUFFIX}.akilirisk.com`;
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
  const host = `${slug}${TENANT_SUBDOMAIN_SUFFIX}.akilirisk.com`;
  expect(pageUrl).toContain(host);
}
