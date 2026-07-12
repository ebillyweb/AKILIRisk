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
test.describe("admin intake question bank", () => {
  test("list page shows intake questions with shared header, edit, and visibility controls", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    const response = await page.goto("/admin/intake/questions");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("heading", { level: 1, name: "Intake question bank" })).toBeVisible();
    await expect(page.getByText(/Configuration/i).first()).toBeVisible();

    await expect(
      page.locator('[data-slot="card-title"]', {
        hasText: /Intake questions \(\d+\)/i,
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
      page.getByText(/Changes are live for new interview loads/i)
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
    await expect(page.getByText(/Changes are live for new interview loads/i)).toBeVisible();

    // Restore so successive runs stay deterministic.
    await showButtons.first().click();
    await expect(hideButtons).toHaveCount(initialHide);
  });
});

/**
 * Coverage for the manual intake-question reordering feature:
 *  - Per-row "Move up" / "Move down" arrows on /admin/intake/questions
 *    (first "Move up" disabled, last "Move down" disabled; each submits a
 *    server action that redirects to ?saved=1).
 *  - The "Order in script" field (#displayOrder) on the edit page, which
 *    repositions a question within its section by shifting siblings.
 *
 * Not tagged @smoke: these mutate admin data and belong in the full e2e run,
 * not the 6-hourly canary. Every test restores the original order.
 */
test.describe("admin intake question reordering", () => {
  // The intake question rows share the same layout as the assessment bank rows.
  const ROW_SELECTOR = "div.flex.flex-col.gap-3.p-4";

  test("reorder arrows move a question and round-trip through the DB", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    await page.goto("/admin/intake/questions");

    const rows = page.locator(ROW_SELECTOR);
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(1);

    // Boundary buttons are disabled: first row cannot move up, last cannot move down.
    await expect(rows.first().getByRole("button", { name: "Move up" })).toBeDisabled();
    await expect(rows.last().getByRole("button", { name: "Move down" })).toBeDisabled();

    // The question text lives in the medium-weight paragraph (not the muted
    // "why this matters" line), so scope to it for a stable row identity.
    const originalFirstText = (
      await rows.first().locator("p.font-medium").first().textContent()
    )?.trim();
    expect(originalFirstText && originalFirstText.length).toBeTruthy();

    await rows.first().getByRole("button", { name: "Move down" }).click();
    await page.waitForURL(/\/admin\/intake\/questions\?saved=1/);
    await expect(page.getByText(/Changes are live for new interview loads/i)).toBeVisible();

    // Fresh navigation isolates the DB round-trip from client-router revalidation.
    await page.goto("/admin/intake/questions");
    const newFirstText = (
      await rows.first().locator("p.font-medium").first().textContent()
    )?.trim();
    expect(newFirstText).not.toBe(originalFirstText);

    // Restore: the moved question now sits lower in the list; nudge it back up.
    const movedRow = page.locator(ROW_SELECTOR, { hasText: originalFirstText! });
    await movedRow.getByRole("button", { name: "Move up" }).click();
    await page.waitForURL(/\/admin\/intake\/questions\?saved=1/);

    await page.goto("/admin/intake/questions");
    const restoredFirstText = (
      await rows.first().locator("p.font-medium").first().textContent()
    )?.trim();
    expect(restoredFirstText).toBe(originalFirstText);
  });

  test("the Order in script field repositions a question safely", async ({ page }) => {
    await new SignInPage(page).signInAs("admin");
    await page.goto("/admin/intake/questions");

    const firstEditLink = page
      .locator('a[href*="/admin/intake/questions/"][href*="/edit"]')
      .first();
    const editHref = await firstEditLink.getAttribute("href");
    expect(editHref).not.toBeNull();

    await firstEditLink.click();
    await page.waitForURL(/\/admin\/intake\/questions\/.*\/edit$/);

    const orderInput = page.locator("#displayOrder");
    const originalOrder = await orderInput.inputValue();
    // Move to a different valid position — prefer 0 (always the section minimum).
    const probeOrder = originalOrder === "0" ? "1" : "0";

    await orderInput.fill(probeOrder);
    await page.getByRole("button", { name: /save changes/i }).click();

    // A safe reposition redirects to the list with the saved banner — no error alert.
    await page.waitForURL(/\/admin\/intake\/questions(\?saved=1)?$/);
    await expect(page.getByText(/Changes are live for new interview loads/i)).toBeVisible();
    await expect(page.getByText(/Could not save/i)).toHaveCount(0);

    // Reload the edit page and confirm the new position persisted.
    await page.goto(editHref!);
    await expect(orderInput).toHaveValue(probeOrder);

    // Restore the original order so repeated runs stay deterministic.
    await orderInput.fill(originalOrder);
    await page.getByRole("button", { name: /save changes/i }).click();
    await page.waitForURL(/\/admin\/intake\/questions(\?saved=1)?$/);

    await page.goto(editHref!);
    await expect(orderInput).toHaveValue(originalOrder);
  });
});
