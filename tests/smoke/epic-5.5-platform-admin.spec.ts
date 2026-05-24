import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Epic 5.5 — Platform Administration & Configuration (BRD US-37–US-46).
 * Each mutating test restores state so runs stay deterministic against seeded data.
 */
test.describe("Epic 5.5 platform administration", () => {
  test.describe("US-37 question bank", () => {
    test("governance area lists pillar questions with edit and visibility controls", async ({
      page,
    }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/question-bank/governance");
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("link", { name: "New question" })).toBeVisible();
      await expect(page.getByText(/Live bank: Belvedere pillar DDL/i)).toBeVisible();

      const editLinks = page.locator('a[href*="/admin/question-bank/governance/"]', {
        hasText: "Edit",
      });
      expect(await editLinks.count()).toBeGreaterThan(0);

      const visibleBadges = await page.getByText(/^Visible$/).count();
      const hiddenBadges = await page.getByText(/^Hidden$/).count();
      expect(visibleBadges + hiddenBadges).toBeGreaterThan(0);
    });

    test("editing question text round-trips through the DB", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/question-bank/governance");

      const firstEdit = page
        .locator('a[href*="/admin/question-bank/governance/"]', { hasText: "Edit" })
        .first();
      const editHref = await firstEdit.getAttribute("href");
      expect(editHref).not.toBeNull();

      await firstEdit.click();
      await page.waitForURL(/\/admin\/question-bank\/governance\/[^/]+$/);

      const textarea = page.locator("#text");
      const originalText = await textarea.inputValue();
      expect(originalText.length).toBeGreaterThan(0);

      const marker = ` [pw-${Date.now()}]`;
      const probeText = `${originalText}${marker}`;

      await textarea.fill(probeText);
      await page.getByRole("button", { name: /save changes/i }).click();
      await page.waitForLoadState("networkidle");

      await page.goto(editHref!);
      await expect(textarea).toHaveValue(probeText);

      await textarea.fill(originalText);
      await page.getByRole("button", { name: /save changes/i }).click();
      await page.waitForLoadState("networkidle");
    });

    test("visibility toggle round-trips through the DB", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/question-bank/governance");

      const hideButtons = page.getByRole("button", { name: /^Hide$/ });
      const showButtons = page.getByRole("button", { name: /^Show$/ });
      const initialHide = await hideButtons.count();
      expect(initialHide).toBeGreaterThan(0);

      await hideButtons.first().click();
      await page.waitForLoadState("networkidle");
      await page.goto("/admin/question-bank/governance");

      expect(await hideButtons.count()).toBe(initialHide - 1);
      expect(await showButtons.count()).toBeGreaterThan(0);

      await showButtons.first().click();
      await page.waitForLoadState("networkidle");
      await page.goto("/admin/question-bank/governance");

      expect(await hideButtons.count()).toBe(initialHide);
    });
  });

  test.describe("US-39 recommendation catalog", () => {
    test("catalog page renders services and rules tabs", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/recommendations");
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("heading", { name: "Recommendations" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Catalog" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Rules" })).toBeVisible();
    });
  });

  test.describe("US-41 risk thresholds", () => {
    test("super admin can open risk thresholds form", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/scoring/thresholds");
      expect(response?.status()).toBe(200);

      await expect(page.getByText("Risk-tier thresholds")).toBeVisible();
      await expect(page.getByRole("button", { name: /save thresholds/i })).toBeVisible();
    });
  });

  test.describe("US-42 feature flags", () => {
    test("super admin settings shows advisor feature flag controls", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/settings");

      await expect(page.getByText("Advisor feature flags")).toBeVisible();
      await expect(page.getByLabel("Advisor governance dashboard")).toBeVisible();
      await expect(page.getByLabel("Advisor risk intelligence")).toBeVisible();
    });
  });

  test.describe("US-43 analytics", () => {
    test("analytics dashboard loads aggregate view", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/analytics");
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    });
  });

  test.describe("US-44 operations health", () => {
    test("admin sidebar exposes Operations Health link", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin");

      await expect(
        page.getByRole("link", { name: "Operations Health" })
      ).toBeVisible();
    });

    test("operations health page loads for admin", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/operations");
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("heading", { name: "Operations" })).toBeVisible();
    });
  });
});
