import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Admin route smoke — every nav target loads without 5xx / app crash, and
 * collateral routes (parent paths, single-subroute pages) behave sanely.
 *
 * The /admin/scoring case is a real cosmetic bug — see tests/INVENTORY.md
 * "Surfaced bugs". /admin/scoring/thresholds is the only child; the parent
 * lacks a page.tsx so direct navigation 404s instead of redirecting.
 */
const ADMIN_ROUTES = [
  "/admin",
  "/admin/advisors",
  "/admin/clients",
  "/admin/leads",
  "/admin/intake",
  "/admin/intake/questions",
  "/admin/assessment",
  "/admin/audit-log",
  "/admin/operations",
  "/admin/recommendations",
  "/admin/recommendations/rules/new",
  "/admin/recommendations/services/new",
  "/admin/exports",
  "/admin/integrations",
  "/admin/question-bank",
  "/admin/scoring/thresholds",
  "/admin/staff",
  "/admin/risk-signals",
  "/admin/analytics",
  "/admin/reports",
  "/admin/settings",
] as const;

test.describe("admin route coverage", () => {
  test("admin can load every nav target without 5xx", async ({ page }) => {
    test.setTimeout(120_000);
    await new SignInPage(page).signInAs("admin");

    const failures: { path: string; status: number | undefined }[] = [];
    for (const route of ADMIN_ROUTES) {
      const response = await page.goto(route);
      const status = response?.status();
      if (!status || status >= 500) {
        failures.push({ path: route, status });
        continue;
      }
      // App-error UIs return 200 but render a generic crash screen.
      const crashed = await page
        .getByText(/something went wrong|application error|did not pass due diligence/i)
        .count();
      if (crashed > 0) {
        failures.push({ path: route, status });
      }
    }

    expect(failures, JSON.stringify(failures)).toEqual([]);
  });

  // Surfaced bug — /admin/scoring 404s because only the /thresholds child has
  // a page.tsx. Should redirect to /admin/scoring/thresholds for stale links.
  test.fixme(
    "/admin/scoring redirects to /admin/scoring/thresholds instead of 404",
    async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/scoring");
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe("/admin/scoring/thresholds");
      await expect(
        page.getByText(/did not pass due diligence/i)
      ).not.toBeVisible();
    }
  );
});

/**
 * Public/unauthenticated endpoints that lack rate limiting today.
 * Failing here means the limit was added — flip the fixme to a regular test.
 */
test.describe("public API hardening", () => {
  test.fixme(
    "/api/address/suggestions rate-limits aggressive callers",
    async ({ request }) => {
      // Hit it 25 times rapid-fire from a single client. The OSM Nominatim
      // backend has a 1 req/sec policy; AkiliRisk is currently a free proxy
      // for any internet caller — no auth, no rate limit.
      const statuses: number[] = [];
      for (let i = 0; i < 25; i++) {
        const r = await request.get(
          `/api/address/suggestions?q=test-${i}-${Date.now()}`
        );
        statuses.push(r.status());
      }
      // Expectation once fixed: at least some 429s in the tail.
      expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    }
  );
});
