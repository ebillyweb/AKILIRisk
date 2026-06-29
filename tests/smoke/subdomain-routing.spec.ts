import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";
import {
  tenantHostOrigin,
  tenantPortalUrl,
  usesTenantPathPortals,
} from "../helpers/tenant-host";

/**
 * White-label tenant routing (subdomain on production, path on preview).
 *
 * Architecture (Next.js 16 `proxy.ts`):
 *  - Production: `{slug}.akilirisk.com` via Host header
 *  - Preview/staging: `preview.akilirisk.com/t/{slug}` via path prefix
 *  - Active + verified -> `/branded/*` rewrite with tenant headers
 *  - Inactive/unverified -> 404 "Subdomain Not Available"
 *
 * Fixtures (scripts/seed-advisor-test-data.js):
 *  - advisor2 -> `independent-wealth` (active+verified)
 *  - advisor3 -> `inactive-tenant` (active, NOT verified)
 *  - advisor4 -> `disabled-tenant` (verified, NOT active)
 */

const ACTIVE_TENANT_URL = tenantPortalUrl("independent-wealth");
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

test.describe("tenant portal routing", () => {
  test("active tenant serves the branded client portal", async ({ page }) => {
    const response = await page.goto(ACTIVE_TENANT_URL);
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/Independent Wealth Group/i);

    await expect(
      page.getByRole("heading", { level: 1, name: /Independent Wealth Group/i })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Comprehensive family risk assessment/i })
    ).toBeVisible();

    const brandedMode = await page.evaluate(
      () => document.body.dataset.brandedMode
    );
    expect(brandedMode).toBe("true");

    await expect(page.getByText(/Powered by AkiliRisk Platform/i)).toBeVisible();

    const signInLink = page.getByRole("link", { name: /^Sign In$/i });
    const expectedSignInHref = usesTenantPathPortals()
      ? "/t/independent-wealth/signin"
      : "/signin";
    await expect(signInLink.first()).toHaveAttribute("href", expectedSignInHref);
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
    // Post sign-in must stay inside the tenant portal: subdomain mode keeps the
    // tenant host; path-portal mode keeps the /t/{slug} prefix.
    if (usesTenantPathPortals()) {
      expect(page.url()).toContain("/t/independent-wealth/advisor");
    } else {
      expect(page.url()).toContain("independent-wealth");
    }
    await expect(
      page.getByRole("navigation", { name: "Advisor workspace" })
    ).toBeVisible();
  });

  for (const { label, url } of NOT_AVAILABLE_CASES) {
    test(`Not Available page renders when tenant is ${label}`, async ({ page }) => {
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
