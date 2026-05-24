import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Coverage for the admin intake script management UI added in 3d3f160.
 *
 * Routes:
 *  - /admin/intake/questions (list)
 *  - /admin/intake/questions/[questionId]/edit
 * Server actions:
 *  - setIntakePillarQuestionVisibility (toggle hide/show)
 *  - updateIntakePillarQuestionContent (edit text/order/visibility)
 *
 * Each test undoes its own change so successive runs stay deterministic.
 */
test.describe("admin intake script management", () => {
  test("list page shows pillar INTAKE questions with edit + visibility controls", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    const response = await page.goto("/admin/intake/questions");
    expect(response?.status()).toBe(200);

    await expect(
      page.locator('[data-slot="card-title"]', {
        hasText: /Script questions \(\d+\)/i,
      })
    ).toBeVisible();

    const editLinks = page.locator(
      'a[href*="/admin/intake/questions/"][href*="/edit"]'
    );
    expect(await editLinks.count()).toBeGreaterThan(0);

    const visibleBadgeCount = await page.getByText(/^Visible$/).count();
    const hiddenBadgeCount = await page.getByText(/^Hidden$/).count();
    expect(visibleBadgeCount + hiddenBadgeCount).toBeGreaterThan(0);
  });

  test("editing a question round-trips the text through the DB", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    await page.goto("/admin/intake/questions");

    const firstEditLink = page
      .locator('a[href*="/admin/intake/questions/"][href*="/edit"]')
      .first();
    const editHref = await firstEditLink.getAttribute("href");
    expect(editHref).not.toBeNull();

    await firstEditLink.click();
    await page.waitForURL(/\/admin\/intake\/questions\/.*\/edit$/);

    const textarea = page.locator("#questionText");
    const originalText = await textarea.inputValue();
    expect(originalText.length).toBeGreaterThan(0);

    const marker = ` [pw-${Date.now()}]`;
    const probeText = `${originalText}${marker}`;

    await textarea.fill(probeText);
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForURL(/\/admin\/intake\/questions(\?saved=1)?$/);
    await expect(
      page.getByText(/Intake script changes are live/i)
    ).toBeVisible();

    await page.goto(editHref!);
    await expect(textarea).toHaveValue(probeText);

    await textarea.fill(originalText);
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForURL(/\/admin\/intake\/questions(\?saved=1)?$/);
  });

  test("toggling a question's visibility round-trips through the DB", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    await page.goto("/admin/intake/questions");

    const initialHide = await page.getByRole("button", { name: /^hide$/i }).count();
    const initialShow = await page.getByRole("button", { name: /^show$/i }).count();
    expect(initialHide).toBeGreaterThan(0);

    await page.getByRole("button", { name: /^hide$/i }).first().click();
    await page.waitForLoadState("networkidle");

    // We do a fresh navigation here to isolate the DB round-trip from the
    // client-router revalidation behavior. The "without a hard reload" case
    // below covers the in-page re-render path (fixed in 487d209 by
    // redirecting to ?saved=1 to bust the prefetched RSC cache).
    await page.goto("/admin/intake/questions");

    expect(await page.getByRole("button", { name: /^hide$/i }).count()).toBe(
      initialHide - 1
    );
    expect(await page.getByRole("button", { name: /^show$/i }).count()).toBe(
      initialShow + 1
    );

    await page.getByRole("button", { name: /^show$/i }).first().click();
    await page.waitForLoadState("networkidle");
    await page.goto("/admin/intake/questions");

    expect(await page.getByRole("button", { name: /^hide$/i }).count()).toBe(initialHide);
    expect(await page.getByRole("button", { name: /^show$/i }).count()).toBe(initialShow);
  });

  test("visibility toggle updates the rendered counts without a hard reload", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    await page.goto("/admin/intake/questions");

    const hideButtons = page.getByRole("button", { name: /^hide$/i });
    const showButtons = page.getByRole("button", { name: /^show$/i });
    const initialHide = await hideButtons.count();

    await hideButtons.first().click();
    // toHaveCount auto-retries until the post-redirect re-render lands.
    // Plain count() can race past the navigation since the redirect target
    // and submit URL are both /admin/intake/questions?saved=1.
    await expect(hideButtons).toHaveCount(initialHide - 1);
    await expect(page.getByText(/Intake script changes are live/i)).toBeVisible();

    // Restore so successive runs stay deterministic.
    await showButtons.first().click();
    await expect(hideButtons).toHaveCount(initialHide);
  });
});
