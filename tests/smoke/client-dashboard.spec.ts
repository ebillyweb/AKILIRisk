import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * After intake submission, the client's dashboard should reflect their
 * intake state in the journey tracker and surface portal destinations.
 */
test.describe("client dashboard", () => {
  test("dashboard reflects submitted intake state", async ({ page }) => {
    await new SignInPage(page).signInAs("clientUnbranded");

    expect(new URL(page.url()).pathname).toBe("/dashboard");

    await expect(page.getByTestId("dashboard-journey")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Explore your portal/i })
    ).toBeVisible();

    await expect(page.getByTestId("dashboard-footer")).toBeVisible();

    const intakeStatusPattern =
      /^(Approved|In review|Pending review|Update needed|Complete|In progress|Not started|Waived by advisor)$/;
    await expect(page.getByText(intakeStatusPattern).first()).toBeVisible();
  });
});
