import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Scheduled `@smoke` canary — critical-path coverage.
 *
 * These tests run against the live **preview** deployment every 6 hours
 * (`.github/workflows/smoke-tests.yml`, `playwright test --grep @smoke`).
 * They exist to catch outages and regressions between deploys, so every
 * case here obeys the canary contract:
 *
 *   1. NO client magic-link. The magic-link flow needs `ENABLE_TEST_AUTH=1`
 *      on the target deployment; preview does not set it, so any client
 *      sign-in would 404 the issuance endpoint and turn the canary red for
 *      an infrastructure reason, not a product regression. Only advisor +
 *      admin password login and unauthenticated requests are used.
 *   2. Assert on STRUCTURAL signals (headings, form fields, status codes,
 *      redirect targets) rather than seeded rows. A canary that depends on
 *      a specific seeded client/advisor record flakes whenever the shared
 *      preview data drifts. The full `npm run test:e2e` suite owns the
 *      data-coupled assertions.
 *
 * See docs/smoke-tests.md for how the scheduled run selects `@smoke` tests
 * (the tags must live on the branch preview deploys from — `staging`).
 */

// ── Area 1: Public / unauthenticated pages ──────────────────────────────
//
// The cheapest, most reliable canaries: no auth, no seeded data. If any of
// these break, the deployment's public front door is down.

test.describe("public pages canary", () => {
  test(
    "landing page renders the hero and a start CTA",
    { tag: "@smoke" },
    async ({ page }) => {
      const response = await page.goto("/");
      expect(response?.status(), "landing page should return 2xx").toBeLessThan(400);

      await expect(page.getByTestId("landing-hero-panel")).toBeVisible();
      const primary = page.getByTestId("landing-hero-primary-cta");
      await expect(primary).toBeVisible();
      await expect(primary).toHaveText(/Start Assessment/i);
    }
  );

  test(
    "advisor sign-in page renders the credentials form",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/signin/advisor");

      // StaffCredentialsPanel — email + password + submit. The password
      // field is the signal that the advisor (not client magic-link) tab
      // is active.
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.locator("#password")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^sign in$/i })
      ).toBeVisible();
    }
  );

  test(
    "client sign-in page renders the magic-link request form",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/signin/client");

      // ClientMagicLinkPanel is email-only — no password field — and asks
      // to send a link rather than sign in directly.
      await expect(page.locator("#email")).toBeVisible();
      await expect(page.locator("#password")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /send me a sign-in link/i })
      ).toBeVisible();
    }
  );

  test(
    "core marketing routes load without a server error",
    { tag: "@smoke" },
    async ({ page }) => {
      const routes = ["/pricing", "/about", "/contact", "/how-it-works"];
      const failures: { path: string; status: number | undefined }[] = [];

      for (const route of routes) {
        const response = await page.goto(route);
        const status = response?.status();
        if (!status || status >= 500) {
          failures.push({ path: route, status });
          continue;
        }
        // App-error boundaries render a 200 crash screen — treat as failure.
        const crashed = await page
          .getByText(/something went wrong|application error/i)
          .count();
        if (crashed > 0) failures.push({ path: route, status });
      }

      expect(failures, JSON.stringify(failures)).toEqual([]);
    }
  );
});

// ── Area 2: Auth & RBAC edge cases ──────────────────────────────────────
//
// Unauthenticated access to a protected workspace must bounce to the
// role-appropriate sign-in with the original destination preserved as
// callbackUrl. Complements auth-edge-cases.spec.ts (which covers /dashboard
// and the signed-in cross-role denials).

test.describe("unauthenticated redirect canary", () => {
  test(
    "unauthenticated /advisor is sent to advisor sign-in with callbackUrl",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/advisor");
      const url = new URL(page.url());
      // buildSignInHref maps the /advisor workspace to /signin/advisor.
      expect(url.pathname).toBe("/signin/advisor");
      expect(url.searchParams.get("callbackUrl")).toBe("/advisor");
      await expect(page.locator("#password")).toBeVisible();
    }
  );

  test(
    "unauthenticated /admin is sent to sign-in with the admin tab and callbackUrl",
    { tag: "@smoke" },
    async ({ page }) => {
      await page.goto("/admin");
      const url = new URL(page.url());
      // Admin has no dedicated /signin/{role} path — the hub selects the
      // tab via ?role=admin (see buildSignInHref).
      expect(url.pathname).toBe("/signin");
      expect(url.searchParams.get("role")).toBe("admin");
      expect(url.searchParams.get("callbackUrl")).toBe("/admin");
    }
  );
});

// ── Area 3: Advisor / admin workflows (password login) ──────────────────
//
// One authenticated page past the dashboard for each staff role, to catch
// regressions that a login-only smoke would miss (e.g. a route that renders
// for the shell but crashes on its first data-backed panel). Assertions are
// structural — headings that render regardless of how much seeded data
// exists — so shared-preview data drift does not flip the canary.

test.describe("staff workflow canary", () => {
  test(
    "advisor can open the pipeline overview",
    { tag: "@smoke" },
    async ({ page }) => {
      await new SignInPage(page).signInAs("advisor");

      await page.goto("/advisor/pipeline");
      await expect(
        page.getByRole("heading", { name: /pipeline overview/i })
      ).toBeVisible();
      await expect(
        page.getByText(/something went wrong|application error/i)
      ).not.toBeVisible();
    }
  );

  test(
    "admin can open the advisor accounts list",
    { tag: "@smoke" },
    async ({ page }) => {
      await new SignInPage(page).signInAs("admin");

      await page.goto("/admin/advisors");
      // The "(N)" count header renders even with zero rows, so this asserts
      // the page mounted its data panel without coupling to a specific
      // seeded advisor.
      await expect(
        page.getByRole("heading", { name: /^advisor accounts \(\d+\)$/i })
      ).toBeVisible();
    }
  );
});

// ── Area 4: Health / API endpoints ──────────────────────────────────────
//
// Lightweight, credential-free endpoint probes that confirm the deployment
// is up and its request gates are wired. No secrets required — they assert
// the *rejection* path, which every deployment enforces.

test.describe("api endpoint canary", () => {
  test(
    "stripe webhook rejects an unsigned POST with 400",
    { tag: "@smoke" },
    async ({ request }) => {
      // No stripe-signature header → the route fails closed before any
      // Stripe secret is consulted (src/app/api/webhooks/stripe/route.ts).
      // A 5xx here means the route crashed instead of gating.
      const res = await request.post("/api/webhooks/stripe", {
        data: { id: "evt_smoke_probe", type: "ping" },
      });
      expect(res.status()).toBe(400);
    }
  );

  test(
    "address suggestions endpoint rejects unauthenticated callers with 401",
    { tag: "@smoke" },
    async ({ request }) => {
      const res = await request.get(
        `/api/address/suggestions?q=smoke-${Date.now()}`
      );
      expect(res.status()).toBe(401);
    }
  );
});
