import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * US-46b — Annotate intake and assessment answers (platform admin).
 */
test.describe("US-46b answer admin notes", () => {
  test("platform admin can add and remove an intake answer note", async ({ page }) => {
    test.setTimeout(90_000);

    await new SignInPage(page).signInAs("admin");
    await page.goto("/admin/intake");
    await expect(page.getByRole("link", { name: "Review answers" }).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("link", { name: "Review answers" }).first().click();
    await page.waitForURL(/\/admin\/intake\/[^/]+$/);
    await expect(page.getByTestId("admin-intake-review-page")).toBeVisible();

    const noteInput = page.getByTestId("answer-admin-note-input").first();
    await noteInput.waitFor({ timeout: 30_000 });
    const probe = `US-46b probe ${Date.now()}`;
    await noteInput.fill(probe);
    await page.getByTestId("answer-admin-note-save").first().click();
    await expect(page.getByTestId("answer-admin-note-display").first()).toContainText(probe, {
      timeout: 15_000,
    });

    await page.getByTestId("answer-admin-note-delete").first().click();
    await expect(page.getByTestId("answer-admin-note-display")).toHaveCount(0);
  });

  test("advisor cannot access admin intake review or see admin notes", async ({ page }) => {
    test.setTimeout(60_000);

    await new SignInPage(page).signInAs("admin");
    await page.goto("/admin/intake");
    const reviewLink = page.getByRole("link", { name: "Review answers" }).first();
    await reviewLink.waitFor({ timeout: 30_000 });
    const href = await reviewLink.getAttribute("href");
    expect(href).toMatch(/^\/admin\/intake\//);

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");
    await page.goto(href!);
    await expect(page).not.toHaveURL(/\/admin\/intake\//);
    await expect(page.getByTestId("answer-admin-note-panel")).toHaveCount(0);
  });
});
