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
    await expect(secondary).toHaveAttribute("href", "/signin?role=client");

    await expect(page.getByTestId("landing-hero-feature-cards")).toBeVisible();
    await expect(page.getByText("Advisor Led")).toBeVisible();
    await expect(page.getByText("Risk Identification")).toBeVisible();
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
    await expect(primary).toHaveAttribute("href", "/signin?role=advisor");

    const secondary = page.getByTestId("landing-hero-secondary-cta");
    await expect(secondary).toHaveText(/Request Demo/i);
    await expect(secondary).toHaveAttribute("href", "/contact?intent=demo");

    await expect(page.getByTestId("landing-hero-feature-cards")).toBeVisible();
    await expect(page.getByText("Client Governance Profiles")).toBeVisible();
    await expect(page.getByText("Risk Scoring & Recommendations")).toBeVisible();
    await expect(page.getByText("Family Continuity Planning")).toBeVisible();
  });

  test("overview tab shows workflow copy and dual-path CTAs", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("landing-hero-tab-overview").click();

    const panel = page.getByTestId("landing-hero-panel");
    await expect(panel).toHaveAttribute("data-audience", "overview");
    await expect(
      page.getByRole("heading", { level: 1, name: /Assess\. Analyze\. Act\./i })
    ).toBeVisible();
    await expect(page.getByTestId("landing-hero-overview-steps")).toBeVisible();

    const primary = page.getByTestId("landing-hero-primary-cta");
    await expect(primary).toHaveText(/Start Assessment/i);
    await expect(primary).toHaveAttribute("href", "/start");

    const secondary = page.getByTestId("landing-hero-secondary-cta");
    await expect(secondary).toHaveText(/Advisor Sign In/i);
    await expect(secondary).toHaveAttribute("href", "/signin?role=advisor");

    await expect(page.getByTestId("landing-hero-workflow-link")).toHaveAttribute(
      "href",
      "#how-it-works"
    );
  });

  test("?audience=overview deep-links the overview tab", async ({ page }) => {
    await page.goto("/?audience=overview");

    await expect(page.getByTestId("landing-hero-panel")).toHaveAttribute(
      "data-audience",
      "overview"
    );
    await expect(page).toHaveURL(/audience=overview/);
    await expect(
      page.getByRole("tab", { name: /Overview/i, selected: true })
    ).toBeVisible();
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

  test("platform product preview renders the pillar radar", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("landing-product-preview")).toBeVisible();
    await expect(page.getByTestId("platform-pillar-radar-preview")).toBeVisible();
  });
});
