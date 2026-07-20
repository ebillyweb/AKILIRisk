import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Operations health canary — live dependency probes on `/admin/operations`.
 *
 * Catches credential / env outages (Stripe, OpenAI, Resend, S3, database)
 * that page-load smokes miss. Prefers `data-testid` / `data-status` when
 * present (post-deploy); falls back to structural labels so the canary
 * stays useful against the current preview build.
 *
 * Soft on Redis / white-label DNS: those can be environment-specific without
 * meaning the product front door is down. Hard-fail when a core service or a
 * billing/AI/email/storage dependency reports `down`.
 */

const CRITICAL_DEPS = [
  { id: "stripe", label: /Stripe \(billing\)/i },
  { id: "openai", label: /^OpenAI$/i },
  { id: "resend", label: /Resend \(email\)/i },
  { id: "s3", label: /Object storage \(S3\)/i },
] as const;

test.describe("operations health canary", () => {
  test(
    "admin operations page shows healthy core services and configured deps",
    { tag: "@smoke" },
    async ({ page }) => {
      test.setTimeout(90_000);

      await new SignInPage(page).signInAs("admin");

      const response = await page.goto("/admin/operations");
      expect(response?.status(), "operations page should return 2xx").toBeLessThan(
        400,
      );

      await expect(
        page.getByRole("heading", { name: /^operations$/i }),
      ).toBeVisible();
      await expect(
        page.getByText(/failed to build the health snapshot/i),
      ).not.toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Core services", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "External dependencies",
          exact: true,
        }),
      ).toBeVisible();

      // Overall roll-up must not claim core services are down.
      await expect(
        page.getByRole("heading", { name: /one or more core services down/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", {
          name: /all core services healthy|operating with degraded service/i,
        }),
      ).toBeVisible();

      const app = page.getByTestId("ops-service-app");
      const database = page.getByTestId("ops-service-database");
      const auth = page.getByTestId("ops-service-auth");
      const hasTestIds = (await app.count()) > 0;

      if (hasTestIds) {
        await expect(app).toHaveAttribute("data-status", "healthy");
        await expect(database).toHaveAttribute("data-status", "healthy");
        await expect(auth).toHaveAttribute("data-status", "healthy");

        for (const { id } of CRITICAL_DEPS) {
          const row = page.getByTestId(`ops-dep-${id}`);
          await expect(row, `ops dep ${id} should render`).toBeVisible();
          await expect(row).toHaveAttribute("data-configured", "true");
          const status = await row.getAttribute("data-status");
          expect(
            status,
            `ops dep ${id} must not be down (got ${status})`,
          ).not.toBe("down");
        }
      } else {
        // Preview build before testid deploy: assert structural labels only.
        await expect(page.getByText("Application API")).toBeVisible();
        await expect(page.getByText("Database", { exact: true })).toBeVisible();
        await expect(page.getByText("Identity / Auth")).toBeVisible();
        for (const { label } of CRITICAL_DEPS) {
          await expect(page.getByText(label)).toBeVisible();
        }
        await expect(page.getByText("Configured").first()).toBeVisible();
        await expect(page.getByText("Healthy").first()).toBeVisible();
      }
    },
  );
});
