import { test, expect } from "@playwright/test";

/**
 * US-61: platform-owned hostnames must not enter tenant branded routing.
 * Unit coverage: platform-subdomain.test.ts (`isPlatformHostname`).
 * This smoke test asserts the main app sign-in page loads on the default base URL
 * (platform host), not a tenant 404 shell.
 */
test.describe("epic 5.7 platform host", () => {
  test("main app sign-in is served on the default Playwright base URL", async ({ page }) => {
    const response = await page.goto("/signin");
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByText(/Subdomain Not Available/i)).toHaveCount(0);
  });
});
