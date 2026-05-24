import { test, expect, type Page } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import { prepareHouseholdProfiles } from "../helpers/household-profiles";
import { USERS } from "../fixtures/users";

async function openAdvisorClientIntakeReview(page: Page, clientEmail: string) {
  await page.goto("/advisor/pipeline");
  const clientLink = page
    .getByRole("link")
    .filter({ hasText: clientEmail })
    .first();
  await clientLink.waitFor({ timeout: 30_000 });
  await page.goto((await clientLink.getAttribute("href"))!);
  await page.getByText(clientEmail).first().waitFor({ timeout: 30_000 });

  const reviewLink = page
    .locator('a[href^="/advisor/review/"]')
    .filter({ hasText: /Review (Responses|Intake)/i })
    .first();
  await reviewLink.click();
  await page.waitForURL(/\/advisor\/review\/[^/]+$/, { timeout: 30_000 });
}

async function addHouseholdMember(
  page: Page,
  options: { shareWithAdvisor?: boolean } = {},
) {
  const share = options.shareWithAdvisor ?? true;

  await page.goto("/profiles");
  await page
    .getByRole("button", { name: /add your first member|add member/i })
    .click();

  const shareCheckbox = page
    .locator("label")
    .filter({ hasText: "Share with my advisor" })
    .locator('input[type="checkbox"]');

  if (share) {
    await shareCheckbox.check();
  } else {
    await shareCheckbox.uncheck();
  }

  await page.getByRole("button", { name: /^add member$/i }).click();
  await expect(page.getByText("Member A").first()).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Epic 5.3 — household profiles CRUD, privacy (US-48), advisor policy (US-49).
 */
test.describe("Epic 5.3 — household profiles", () => {
  test.beforeEach(async ({ request }) => {
    await skipUnlessTestAuth(request);
    await prepareHouseholdProfiles(request, {
      clientEmail: USERS.client.email,
      advisorEmail: USERS.advisor.email,
      resetMembers: true,
      householdProfilesEnabled: true,
    });
  });

  test("US-21: client adds a household member", async ({ page }) => {
    test.setTimeout(120_000);

    await new SignInPage(page).signInAs("client");
    await addHouseholdMember(page, { shareWithAdvisor: true });

    await expect(
      page.getByRole("link", { name: "Profiles & Roles" }),
    ).toBeVisible();
    await expect(page.getByText("Spouse").first()).toBeVisible();
  });

  test("US-48: hidden members are omitted from advisor intake review", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await new SignInPage(page).signInAs("client");
    await addHouseholdMember(page, { shareWithAdvisor: true });

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");
    await openAdvisorClientIntakeReview(page, USERS.client.email);

    await expect(page.getByText("Member A").first()).toBeVisible();
    await expect(page.getByText(/1 profile/i)).toBeVisible();

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("client");

    await page.goto("/profiles");
    await page.getByRole("button", { name: /edit member a/i }).click();
    await page
      .locator("label")
      .filter({ hasText: "Share with my advisor" })
      .locator('input[type="checkbox"]')
      .uncheck();
    await page.getByRole("button", { name: /^update member$/i }).click();
    await expect(page.getByText("Hidden from advisor").first()).toBeVisible();

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");
    await openAdvisorClientIntakeReview(page, USERS.client.email);

    await expect(
      page.getByText(/This client has not added household profiles yet/i),
    ).toBeVisible();
    await expect(page.getByText(/No household profiles on file yet/i)).toBeVisible();
    await expect(page.getByText("Member A")).not.toBeVisible();
  });

  test("US-49: advisor disabling profiles hides client nav and /profiles", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await new SignInPage(page).signInAs("client");
    await expect(
      page.getByRole("link", { name: "Profiles & Roles" }),
    ).toBeVisible();
    await page.goto("/profiles");
    await expect(
      page.getByRole("button", { name: /add your first member|add member/i }),
    ).toBeVisible();

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("advisor");
    await page.goto("/advisor/settings");
    await expect(page.getByRole("heading", { name: "Household profiles" })).toBeVisible();

    const policyCheckbox = page.getByRole("checkbox", {
      name: /household profiles/i,
    });
    await policyCheckbox.uncheck();
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(
      page.getByText(/Household profiles disabled for your clients/i),
    ).toBeVisible({ timeout: 15_000 });

    await page.context().clearCookies();
    await new SignInPage(page).signInAs("client");
    await page.goto("/dashboard");
    await expect(
      page.getByRole("link", { name: "Profiles & Roles" }),
    ).not.toBeVisible();

    await page.goto("/profiles");
    await expect(
      page.getByText(/Household profiles are not available/i),
    ).toBeVisible();
  });
});
