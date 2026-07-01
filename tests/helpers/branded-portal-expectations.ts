import { expect } from "@playwright/test";

/** Shared assertions for advisor-branded client portal shells (platform or tenant host). */
export async function expectBrandedClientPortalShell(
  page: import("@playwright/test").Page
): Promise<void> {
  await expect(
    page.getByText(/Brought to you by AKILI Risk Intelligence/i)
  ).toBeVisible({ timeout: 15_000 });

  const advisorLogo = page.locator('img[src*="/api/branded/advisor-logo"]');
  await expect(advisorLogo.first()).toBeVisible();

  const advisorPrimary = await page.evaluate(() =>
    getComputedStyle(document.documentElement)
      .getPropertyValue("--advisor-primary")
      .trim()
  );
  expect(advisorPrimary.length, "--advisor-primary CSS var is set").toBeGreaterThan(0);
}

export async function expectBrandingUnavailableNotShown(
  page: import("@playwright/test").Page
): Promise<void> {
  await expect(page.getByRole("heading", { name: /Portal not available/i })).toHaveCount(
    0
  );
}
