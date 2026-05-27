import { test, expect } from "@playwright/test";

test.describe("landing hero audience paths", () => {
  test("families tab is default and exposes family CTAs", async ({ page }) => {
    await page.goto("/");

    const panel = page.getByTestId("landing-hero-panel");
    await expect(panel).toHaveAttribute("data-audience", "families");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /governance intelligence platform for modern family wealth/i,
      })
    ).toBeVisible();

    const primary = page.getByTestId("landing-hero-primary-cta");
    await expect(primary).toHaveText(/Start Assessment/i);
    await expect(primary).toHaveAttribute("href", "/start");

    const secondary = page.getByTestId("landing-hero-secondary-cta");
    await expect(secondary).toHaveText(/Sign In/i);
    await expect(secondary).toHaveAttribute("href", "/signin");
  });

  test("advisors tab shows advisor workspace copy and CTAs", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("landing-hero-tab-advisors").click();

    const panel = page.getByTestId("landing-hero-panel");
    await expect(panel).toHaveAttribute("data-audience", "advisors");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /governance intelligence for modern advisory firms/i,
      })
    ).toBeVisible();

    const primary = page.getByTestId("landing-hero-primary-cta");
    await expect(primary).toHaveText(/Advisor Sign In/i);
    await expect(primary).toHaveAttribute("href", "/signin?portal=advisor");

    const secondary = page.getByTestId("landing-hero-secondary-cta");
    await expect(secondary).toHaveText(/Request Demo/i);
    await expect(secondary).toHaveAttribute("href", "/contact?intent=demo");
  });

  test("?audience=advisors deep-links the advisor tab", async ({ page }) => {
    await page.goto("/?audience=advisors");

    await expect(page.getByTestId("landing-hero-panel")).toHaveAttribute(
      "data-audience",
      "advisors"
    );
    await expect(page).toHaveURL(/audience=advisors/);
    await expect(
      page.getByRole("tab", { name: /For Advisors/i, selected: true })
    ).toBeVisible();
  });

  test("#advisors hash deep-links the advisor tab", async ({ page }) => {
    await page.goto("/#advisors");

    await expect(page.getByTestId("landing-hero-panel")).toHaveAttribute(
      "data-audience",
      "advisors"
    );
  });

  test("request demo pre-fills the contact form", async ({ page }) => {
    await page.goto("/?audience=advisors");
    await expect(page.getByTestId("landing-hero-panel")).toHaveAttribute(
      "data-audience",
      "advisors"
    );
    const demoCta = page.getByTestId("landing-hero-secondary-cta");
    await expect(demoCta).toHaveText(/Request Demo/i);
    await demoCta.click();

    await expect(page).toHaveURL(/\/contact\?intent=demo/);
    const subject = page.getByTestId("contact-form-subject");
    await expect(subject).toHaveValue(/demonstration request/i);
  });

  test("remembers last audience in session storage", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("landing-hero-tab-advisors").click();

    await page.goto("/");
    await expect(page.getByTestId("landing-hero-panel")).toHaveAttribute(
      "data-audience",
      "advisors"
    );
  });
});
