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
      const response = await page.goto("/admin/assessment/questions/governance");
      expect(response?.status()).toBe(200);

      await expect(page.getByRole("link", { name: "New question" })).toBeVisible();
      const editLinks = page.locator('a[href*="/admin/assessment/questions/governance/"]', {
        hasText: "Edit",
      });
      expect(await editLinks.count()).toBeGreaterThan(0);

      const visibleBadges = await page.getByText(/^Visible$/).count();
      const hiddenBadges = await page.getByText(/^Hidden$/).count();
      expect(visibleBadges + hiddenBadges).toBeGreaterThan(0);
    });

    test("editing question text round-trips through the DB", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/assessment/questions/governance");

      const firstEdit = page
        .locator('a[href*="/admin/assessment/questions/governance/"]', { hasText: "Edit" })
        .first();
      const editHref = await firstEdit.getAttribute("href");
      expect(editHref).not.toBeNull();

      await firstEdit.click();
      await page.waitForURL(/\/admin\/assessment\/questions\/governance\/[^/]+$/);

      const textarea = page.locator("#text");
      const originalText = await textarea.inputValue();
      expect(originalText.length).toBeGreaterThan(0);

      const suffix = ` Playwright probe ${Date.now()}`;
      const probeText = `${originalText}${suffix}`;

      await textarea.fill(probeText);
      await page.getByRole("button", { name: /save changes/i }).click();
      await page.waitForURL(/saved=1/);
      await expect(page.getByText(/Question bank changes are live/i)).toBeVisible();

      await page.goto(editHref!);
      await expect(textarea).toHaveValue(probeText);

      await textarea.fill(originalText);
      await page.getByRole("button", { name: /save changes/i }).click();
      await page.waitForURL(/saved=1/);
    });

    test("visibility toggle round-trips through the DB", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/assessment/questions/governance");

      const firstRow = page.locator("div.flex.flex-col.gap-3.p-4").first();
      const hideButton = firstRow.getByRole("button", { name: /^Hide$/ });
      await expect(hideButton).toBeVisible();

      await hideButton.click();
      await page.waitForURL(/\/admin\/assessment\/questions\/governance\?saved=1/);
      await expect(page.getByText(/Question bank changes are live/i)).toBeVisible();

      const showButton = firstRow.getByRole("button", { name: /^Show$/ });
      await expect(showButton).toBeVisible();

      await showButton.click();
      await page.waitForURL(/\/admin\/assessment\/questions\/governance\?saved=1/);

      await expect(firstRow.getByRole("button", { name: /^Hide$/ })).toBeVisible();
    });

    test("creating and deleting a question round-trips through the DB", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const probeText = `Playwright probe ${Date.now()}`;

      await page.goto("/admin/assessment/questions/governance/new");
      const sectionSelect = page.locator("#sectionId");
      await sectionSelect.selectOption({ index: 1 });
      await page.locator("#text").fill(probeText);
      await page.getByRole("button", { name: /create question/i }).click();
      await page.waitForURL(/\/admin\/assessment\/questions\/governance(\?saved=1)?$/);
      await expect(page.getByText(probeText)).toBeVisible();

      page.once("dialog", (dialog) => dialog.accept());
      const probeRow = page.locator("div.flex.flex-col.gap-3.p-4", { hasText: probeText });
      await probeRow.getByRole("button", { name: /^Delete$/ }).click();
      await page.waitForURL(/\/admin\/assessment\/questions\/governance(\?|$)/);
      await expect(probeRow).toHaveCount(0);
    });

    test("reorder controls are enabled and submit without error", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin/assessment/questions/governance");

      const moveDown = page.getByRole("button", { name: "Move down", disabled: false }).first();
      await expect(moveDown).toBeEnabled();
      await moveDown.click();
      await page.waitForURL(/\/admin\/assessment\/questions\/governance\?saved=1/);
      await expect(page.getByText(/Question bank changes are live/i)).toBeVisible();
    });

    test("creating a question writes a pillar_question.create audit row", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const probeText = `Audit probe ${Date.now()}`;

      await page.goto("/admin/assessment/questions/governance/new");
      await page.locator("#sectionId").selectOption({ index: 1 });
      await page.locator("#text").fill(probeText);
      await page.getByRole("button", { name: /create question/i }).click();
      await page.waitForURL(/\/admin\/assessment\/questions\/governance(\?saved=1)?$/);

      await page.goto("/admin/audit-log?action=pillar_question.create");
      const createRow = page
        .locator('[data-testid="audit-log-row"][data-action="pillar_question.create"]')
        .first();
      await expect(createRow).toBeVisible();
      await createRow.getByRole("button").click();
      const expandedText = await createRow.textContent();
      expect(expandedText).toMatch(/before[\s\S]*null/i);
      expect(expandedText).toContain(probeText);

      page.once("dialog", (dialog) => dialog.accept());
      await page.goto("/admin/assessment/questions/governance");
      await page
        .locator("div.flex.flex-col.gap-3.p-4", { hasText: probeText })
        .getByRole("button", { name: /^Delete$/ })
        .click();
      await page.waitForURL(/\/admin\/assessment\/questions\/governance$/);
    });

    test("assessment bank index shows shared header and risk-area cards", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/assessment/questions");
      expect(response?.status()).toBe(200);

      await expect(
        page.getByRole("heading", { level: 1, name: "Assessment question bank" })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Governance", exact: true })
      ).toBeVisible();
    });

    test("legacy /admin/question-bank URLs redirect to canonical assessment paths", async ({
      page,
    }) => {
      await new SignInPage(page).signInAs("admin");

      await page.goto("/admin/question-bank");
      await expect(page).toHaveURL(/\/admin\/assessment\/questions\/?$/);

      await page.goto("/admin/question-bank/governance");
      await expect(page).toHaveURL(/\/admin\/assessment\/questions\/governance\/?$/);
    });
  });

  test.describe("Admin IA and access control", () => {
    test("control center exposes configuration question bank cards", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      await page.goto("/admin");

      await expect(page.getByRole("heading", { name: "AKILI Control Center" })).toBeVisible();
      await expect(page.getByRole("link", { name: /Intake question bank/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Assessment question bank/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Risk-tier thresholds/i })).toBeVisible();
    });

    test("platform ADMIN can use question banks but not super-admin-only surfaces", async ({
      page,
    }) => {
      await new SignInPage(page).signInAs("platformAdmin");
      await page.goto("/admin");
      expect(new URL(page.url()).pathname).toBe("/admin");

      await expect(page.getByRole("link", { name: /Intake question bank/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Assessment question bank/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Risk-tier thresholds/i })).not.toBeVisible();

      const intakeResponse = await page.goto("/admin/intake/questions");
      expect(intakeResponse?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { level: 1, name: "Intake question bank" })
      ).toBeVisible();

      await page.goto("/admin/settings");
      await expect(page.getByLabel("Advisor governance dashboard")).not.toBeVisible();
      await expect(page.getByLabel("Advisor risk intelligence")).not.toBeVisible();

      const thresholdsResponse = await page.goto("/admin/scoring/thresholds");
      expect(thresholdsResponse?.status()).not.toBe(200);
      await expect(page.getByRole("button", { name: /save thresholds/i })).not.toBeVisible();

      const provisionResponse = await page.goto("/admin/staff/admin-users");
      expect(provisionResponse?.status()).not.toBe(200);
      await expect(
        page.getByRole("heading", { name: "Admin User Management" })
      ).not.toBeVisible();
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

      await expect(
        page.getByRole("heading", { name: "Risk-tier thresholds" })
      ).toBeVisible();
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

  test.describe("Platform risk signals", () => {
    test("super admin can open risk signals dashboard", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");
      const response = await page.goto("/admin/risk-signals");
      expect(response?.status()).toBe(200);

      await expect(
        page.getByRole("heading", { name: "Risk signals", level: 1 })
      ).toBeVisible();
      await expect(page.getByText("Portfolio risk snapshot")).toBeVisible();
    });

    test("platform admin cannot open super-admin risk signals", async ({
      page,
    }) => {
      await new SignInPage(page).signInAs("platformAdmin");
      const response = await page.goto("/admin/risk-signals");
      expect(response?.status()).not.toBe(200);
      await expect(
        page.getByRole("heading", { name: "Risk signals", level: 1 })
      ).not.toBeVisible();
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
        .locator('[data-slot="card"]')
        .filter({ hasText: USERS.advisor.email })
        .getByRole("link", { name: /^Edit / })
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
      await expect(page.getByRole("link", { name: /open question bank/i })).toBeVisible();

      const assessmentResponse = await page.goto("/admin/assessment");
      expect(assessmentResponse?.status()).toBe(200);
      await expect(page.locator("h1", { hasText: "Assessments" })).toBeVisible();
      await expect(page.getByText(/Assessments \(\d+\)/)).toBeVisible();
    });
  });

  test.describe("US-46 platform staff accounts", () => {
    test("legacy staff route redirects to admin user management", async ({ page }) => {
      await new SignInPage(page).signInAs("admin");

      await page.goto("/admin/staff");
      await expect(page).toHaveURL(/\/admin\/staff\/admin-users$/);
      await expect(page.getByRole("heading", { name: "Admin User Management" })).toBeVisible();
    });
  });
});
