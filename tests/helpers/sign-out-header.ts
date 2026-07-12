import { expect, type Page } from "@playwright/test";

/** Marketing site header shows authenticated CTAs. */
export async function expectMarketingHeaderAuthenticated(page: Page) {
  await expect(page.getByRole("link", { name: /go to dashboard/i })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^sign out$/i }).first(),
  ).toBeVisible();
}

/** Marketing site header shows the public Sign In / Start Assessment pair. */
export async function expectMarketingHeaderSignedOut(page: Page) {
  await expect(page.getByRole("link", { name: /go to dashboard/i })).toBeHidden();
  await expect(
    page.getByRole("link", { name: /^sign in$/i }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /start assessment/i }).first(),
  ).toBeVisible();
}

export async function signOutFromHeader(page: Page) {
  await page.getByRole("button", { name: /^sign out$/i }).first().click();
}
