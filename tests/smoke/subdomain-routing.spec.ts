import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";
import { tenantHostOrigin } from "../helpers/tenant-host";

/**
 * Subdomain-based white-label routing.
 *
 * Architecture (Next.js 16 `proxy.ts` convention):
 *  - `src/proxy.ts` extracts subdomain from `Host`, looks up `AdvisorSubdomain`
 *    via `getAdvisorBySubdomain` (returns the row whenever `brandingEnabled`
 *    on the advisor; the proxy decides what to do with it).
 *  - If `isActive && dnsVerified` -> rewrites to `/branded/<path>` with
 *    `x-advisor-id`/`x-subdomain` headers for client-portal pages, OR passes
 *    through to the main app tree for `/signup`, `/signin`, `/advisor`, etc.
 *  - Anything else (row exists but `dnsVerified=false`, or `isActive=false`)
 *    -> static 404 HTML "Subdomain Not Available".
 *
 * Seeded fixtures (scripts/seed-advisor-test-data.js):
 *  - advisor2 -> `independent-wealth` (active+verified)
 *  - advisor3 -> `inactive-tenant` (active, NOT verified)
 *  - advisor4 -> `disabled-tenant` (verified, NOT active)
 *
 * Vercel: wildcard `*.akilirisk.com` on Preview. When TENANT_SUBDOMAIN_SUFFIX is
 * set (e.g. `-staging` on preview.akilirisk.com), tenant hosts are
 * `{slug}-staging.akilirisk.com`, not bare `{slug}.akilirisk.com`.
 */

const TENANT_SUBDOMAIN_SUFFIX = process.env.TENANT_SUBDOMAIN_SUFFIX ?? "";

function tenantPortalUrl(slug: string): string {
  return `https://${slug}${TENANT_SUBDOMAIN_SUFFIX}.akilirisk.com/`;
}

const ACTIVE_SUBDOMAIN_URL = tenantPortalUrl("independent-wealth");
const NOT_AVAILABLE_CASES: { label: string; url: string }[] = [
  {
    label: "active but not dnsVerified",
    url: tenantPortalUrl("inactive-tenant"),
  },
  {
    label: "dnsVerified but not active",
    url: tenantPortalUrl("disabled-tenant"),
  },
];

test.describe("subdomain routing", () => {
  test("active subdomain serves the branded client portal", async ({ page }) => {
    const response = await page.goto(ACTIVE_SUBDOMAIN_URL);
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/Independent Wealth Group/i);

    await expect(
      page.getByRole("heading", { level: 1, name: /Independent Wealth Group/i })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Comprehensive Family Risk Assessment/i })
    ).toBeVisible();

    const brandedMode = await page.evaluate(
      () => document.body.dataset.brandedMode
    );
    expect(brandedMode).toBe("true");

    await expect(page.getByText(/Powered by AkiliRisk Platform/i)).toBeVisible();

    const signInLink = page.getByRole("link", { name: /^Sign In$/i });
    await expect(signInLink.first()).toHaveAttribute("href", "/signin");
  });

  test("advisor credentials sign-in on tenant host reaches /advisor workspace", async ({
    page,
  }) => {
    const signInUrl = `${tenantHostOrigin("independent-wealth")}/signin?role=advisor&callbackUrl=%2Fadvisor`;
    await page.goto(signInUrl);

    const user = USERS.advisor2;
    await page.locator("#email").fill(user.email);
    await page.locator("#password").fill(user.password);
    await page.getByRole("button", { name: /^sign in$/i }).click();

    await page.waitForURL(/\/advisor(\/|$|\?)/, { timeout: 30_000 });
    expect(page.url()).toContain("independent-wealth");
    await expect(
      page.getByRole("navigation", { name: "Advisor workspace" })
    ).toBeVisible();
  });

  for (const { label, url } of NOT_AVAILABLE_CASES) {
    test(`Not Available page renders when subdomain is ${label}`, async ({ page }) => {
      const response = await page.goto(url);
      expect(response?.status()).toBe(404);

      await expect(
        page.getByRole("heading", { name: /^Subdomain Not Available$/i })
      ).toBeVisible();
      await expect(
        page.getByText(/This subdomain is not currently active/i)
      ).toBeVisible();
    });
  }
});
