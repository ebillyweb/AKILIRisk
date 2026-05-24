import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";

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

    test("creating and deleting a question round-trips through the DB", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const probeText = `Playwright probe ${Date.now()}`;

      await page.goto("/admin/question-bank/governance/new");
      const sectionSelect = page.locator("#sectionId");
      const sectionId = await sectionSelect
        .locator("option:not([disabled])")
        .first()
        .getAttribute("value");
      expect(sectionId).toBeTruthy();
      await sectionSelect.selectOption(sectionId!);
      await page.locator("#text").fill(probeText);
      await page.getByRole("button", { name: /create question/i }).click();
      await page.waitForURL(/\/admin\/question-bank\/governance$/);
      await expect(page.getByText(probeText)).toBeVisible();

      page.once("dialog", (dialog) => dialog.accept());
      await page
        .locator("div.flex.flex-col.gap-3.p-4", { hasText: probeText })
        .getByRole("button", { name: /^Delete$/ })
        .click();
      await page.waitForLoadState("networkidle");
      await page.goto("/admin/question-bank/governance");
      await expect(page.getByText(probeText)).toHaveCount(0);
    });

    test("reorder moves a question down and back", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/question-bank/governance");

      const questionIds = page.locator("code.text-xs.text-muted-foreground");
      const firstIdBefore = await questionIds.nth(0).innerText();
      const secondIdBefore = await questionIds.nth(1).innerText();

      await page.getByRole("button", { name: "Move down" }).first().click();
      await page.waitForLoadState("networkidle");
      await page.goto("/admin/question-bank/governance");

      await expect(questionIds.nth(0)).toHaveText(secondIdBefore);
      await expect(questionIds.nth(1)).toHaveText(firstIdBefore);

      await page.getByRole("button", { name: "Move up" }).nth(1).click();
      await page.waitForLoadState("networkidle");
      await page.goto("/admin/question-bank/governance");

      await expect(questionIds.nth(0)).toHaveText(firstIdBefore);
      await expect(questionIds.nth(1)).toHaveText(secondIdBefore);
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

    test("creating a catalog service round-trips through the list", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const serviceName = `PW Service ${Date.now()}`;

      await page.goto("/admin/recommendations/services/new");
      await page.locator("#name").fill(serviceName);
      await page.locator("#description").fill("Playwright catalog probe");
      await page.locator("#category").fill("testing");
      await page.getByRole("button", { name: /^Create$/i }).click();
      await page.waitForURL(/\/admin\/recommendations$/);
      await expect(page.getByRole("link", { name: serviceName })).toBeVisible();

      await page.getByRole("link", { name: serviceName }).click();
      await page.waitForURL(/\/admin\/recommendations\/services\/[^/]+\/edit$/);
      await page.locator("#description").fill("Playwright catalog probe (edited)");
      await page.getByRole("button", { name: /save changes/i }).click();
      await page.waitForURL(/\/admin\/recommendations$/);

      await page.getByRole("link", { name: serviceName }).click();
      await page.getByLabel("Active (visible to the recommendation engine)").click();
      await page.getByRole("button", { name: /save changes/i }).click();
      await page.waitForURL(/\/admin\/recommendations$/);
      await expect(page.getByRole("link", { name: serviceName })).toBeVisible();
    });
  });

  test.describe("US-40 recommendation rules", () => {
    test("rules tab and new rule form render", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/recommendations?view=rules");
      await expect(page.getByText(/Recommendation rules \(\d+\)/)).toBeVisible();
      await expect(page.getByRole("link", { name: "New rule" })).toBeVisible();

      await page.goto("/admin/recommendations/rules/new");
      await expect(page.getByText("New rule")).toBeVisible();
      await expect(page.locator("#triggerConditions")).toBeVisible();
      await expect(page.getByRole("button", { name: /create rule/i })).toBeVisible();
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

    test("super admin can save and restore threshold values", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/scoring/thresholds");

      const lowInput = page.locator("#lowMin");
      const originalLow = Number(await lowInput.inputValue());
      const probeLow = originalLow > 1 ? originalLow - 1 : originalLow + 1;

      await lowInput.fill(String(probeLow));
      await page.getByRole("button", { name: /save thresholds/i }).click();
      await expect(page.getByText("Risk thresholds saved")).toBeVisible();

      await page.reload();
      await expect(lowInput).toHaveValue(String(probeLow));

      await lowInput.fill(String(originalLow));
      await page.getByRole("button", { name: /save thresholds/i }).click();
      await expect(page.getByText("Risk thresholds saved")).toBeVisible();
    });

    test("non-admin users cannot reach super-admin threshold settings", async ({ page }) => {
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/admin/scoring/thresholds");
      expect(new URL(page.url()).pathname).toBe("/advisor");
      await expect(page.getByText("Risk-tier thresholds")).not.toBeVisible();
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

    test("toggling a feature flag round-trips through the DB", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/settings");

      const governance = page.getByLabel("Advisor governance dashboard");
      const wasChecked = await governance.isChecked();

      await governance.click();
      await expect(page.getByText("Feature flags updated")).toBeVisible();

      await page.reload();
      await expect(governance).toBeChecked({ checked: !wasChecked });

      await governance.click();
      await expect(page.getByText("Feature flags updated")).toBeVisible();
      await page.reload();
      await expect(governance).toBeChecked({ checked: wasChecked });
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

  test.describe("US-45 advisor and client accounts", () => {
    test("client accounts list renders seeded client", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/clients");
      expect(response?.status()).toBe(200);

      await expect(page.getByText(/Client accounts \(\d+\)/)).toBeVisible();
      await expect(page.getByText(USERS.client.email).first()).toBeVisible();
    });

    test("advisor edit page exposes portal access controls", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/advisors");
      await page
        .locator("div")
        .filter({ hasText: USERS.advisor.email })
        .getByRole("link", { name: /^Edit /i })
        .click();
      await page.waitForURL(/\/admin\/advisors\/[^/]+\/edit$/);

      await expect(page.getByLabel("Advisor portal access enabled")).toBeVisible();
      await expect(page.getByRole("button", { name: /deactivate advisor/i })).toBeVisible();
    });

    test("governance leads page renders assignment table", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/leads");
      expect(response?.status()).toBe(200);

      await expect(page.getByText(/Assessment requests \(\d+\)/)).toBeVisible();
    });

    test("intake management and assessment admin views load", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");

      const intakeResponse = await page.goto("/admin/intake");
      expect(intakeResponse?.status()).toBe(200);
      await expect(page.getByText(/Intake interviews \(\d+\)/)).toBeVisible();
      await expect(page.getByRole("link", { name: /manage script questions/i })).toBeVisible();

      const assessmentResponse = await page.goto("/admin/assessment");
      expect(assessmentResponse?.status()).toBe(200);
      await expect(page.locator("h1", { hasText: "Assessments" })).toBeVisible();
      await expect(page.getByText(/Assessments \(\d+\)/)).toBeVisible();
    });
  });

  test.describe("US-46 platform staff accounts", () => {
    test("staff list and super-admin provisioning page load", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");

      const staffResponse = await page.goto("/admin/staff");
      expect(staffResponse?.status()).toBe(200);
      await expect(page.getByText("Platform staff")).toBeVisible();
      await expect(page.getByText(USERS.admin.email)).toBeVisible();

      const provisionResponse = await page.goto("/admin/staff/admin-users");
      expect(provisionResponse?.status()).toBe(200);
      await expect(page.getByRole("heading", { name: "Admin User Management" })).toBeVisible();
    });
  });
});
