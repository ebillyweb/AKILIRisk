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

  test("/admin/scoring redirects to /admin/scoring/thresholds", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    const response = await page.goto("/admin/scoring");
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/admin/scoring/thresholds");
    await expect(
      page.getByText(/did not pass due diligence/i)
    ).not.toBeVisible();
  });
});

/**
 * `/api/address/suggestions` proxies OSM Nominatim. Both gates were added
 * in the same commit that flipped these fixmes — see "Fixed" in
 * tests/INVENTORY.md.
 */
test.describe("address suggestions hardening", () => {
  test("unauthenticated callers get 401", async ({ request }) => {
    const r = await request.get(
      `/api/address/suggestions?q=test-${Date.now()}`
    );
    expect(r.status()).toBe(401);
  });

  test("authenticated callers are rate-limited under sustained load", async ({
    page,
    request,
  }) => {
    await new SignInPage(page).signInAs("admin");
    const cookies = (await page.context().cookies())
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    // Limit is 20/min per IP. Send 35 to leave headroom for Vercel's
    // per-instance limiter fanout (same caveat as the magic-link
    // rate-limit test in auth-flow-hardening.spec.ts).
    const codes: number[] = [];
    for (let i = 0; i < 35; i++) {
      const r = await request.get(
        `/api/address/suggestions?q=test-${i}-${Date.now()}`,
        { headers: { cookie: cookies } }
      );
      codes.push(r.status());
    }
    const limited = codes.filter((c) => c === 429).length;
    expect(
      limited,
      `expected at least one 429 across 35 authenticated requests, saw ${codes.join(",")}`
    ).toBeGreaterThan(0);
  });
});
