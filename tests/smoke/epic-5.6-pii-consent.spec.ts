import { test, expect } from "@playwright/test";

import { SignInPage } from "../page-objects/SignInPage";
import { USERS } from "../fixtures/users";
import { skipUnlessTestAuth } from "../helpers/test-auth";
import {
  prepareAdvisorPiiPolicy,
  prepareClientConsent,
  signInClientViaMagicLink,
} from "../helpers/consent-prepare";
import { signOutToSignIn } from "../helpers/mfa";

/** Seeded legal name on client@test.com — must differ from email for redaction tests. */
const SEEDED_CLIENT_LEGAL_NAME = "Test Client";

/**
 * Epic 5.6 — US-50 (advisor PII policy) and US-51 (client consent gate).
 */

/** Expand the first matching audit row and return its text (including metadata). */
async function expandAuditRowText(
  page: import("@playwright/test").Page,
  action: string
): Promise<string> {
  await page.goto(`/admin/audit-log?action=${encodeURIComponent(action)}`);
  await expect(
    page.getByRole("heading", { name: /^audit log \(\d/i })
  ).toBeVisible({ timeout: 15_000 });

  const row = page
    .locator(`[data-testid="audit-log-row"][data-action="${action}"]`)
    .first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.locator("details > summary").click();
  return (await row.locator("details").textContent()) ?? "";
}

test.describe("Epic 5.6 — PII policy & consent (US-50 / US-51)", () => {
  test.describe("US-50 — advisor PII policy", () => {
    test("advisor can open the policy page and save a toggle", async ({
      page,
    }) => {
      const signIn = new SignInPage(page);
      await signIn.signInAs("advisor");

      await page.goto("/advisor/settings/pii-policy");
      await expect(
        page.getByRole("heading", { name: /^Client data policy$/i })
      ).toBeVisible();
      await expect(page.getByText("Client phone")).toBeVisible();

      const phoneRow = page.locator('[data-pii-field="ClientProfile.phone"]');
      const phoneToggle = phoneRow.getByRole("checkbox");
      const wasChecked =
        (await phoneToggle.getAttribute("data-state")) === "checked";

      await phoneToggle.click();
      await page.getByRole("button", { name: /save policy/i }).click();

      await expect(page.getByText(/saved\./i)).toBeVisible({ timeout: 15_000 });

      if (
        wasChecked !==
        ((await phoneToggle.getAttribute("data-state")) === "checked")
      ) {
        await phoneToggle.click();
        await page.getByRole("button", { name: /save policy/i }).click();
        await expect(page.getByText(/saved\./i)).toBeVisible({
          timeout: 15_000,
        });
      }
    });
  });

  test.describe("US-51 — client consent gate", () => {
    test.beforeEach(async ({ request }) => {
      await skipUnlessTestAuth(request);
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        resetPending: true,
      });
    });

    test.afterEach(async ({ request }) => {
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        restoreConsented: true,
      });
    });

    test("pending consent redirects to /consent/pending and Continue reaches dashboard", async ({
      page,
      request,
    }) => {
      await signInClientViaMagicLink(page, request, USERS.client.email);

      await page.waitForURL(/\/consent\/pending/, { timeout: 30_000 });
      await expect(
        page.getByRole("heading", { name: /consent preferences/i })
      ).toBeVisible();

      const phoneField = page.locator('[data-pii-field="ClientProfile.phone"]');
      await phoneField.getByText("Yes, allow").click();

      await page.getByRole("button", { name: /^continue to (dashboard|assessment)$/i }).click();

      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
      await expect(page.getByText(/welcome back/i)).toBeVisible();
    });

    test("omitted fields default to No when Continue is clicked", async ({
      page,
      request,
    }) => {
      await signInClientViaMagicLink(page, request, USERS.client.email);
      await page.waitForURL(/\/consent\/pending/, { timeout: 30_000 });

      await page.getByRole("button", { name: /^continue to (dashboard|assessment)$/i }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    });

    test("signed-in client navigating to /dashboard is redirected to consent", async ({
      page,
      request,
    }) => {
      await signInClientViaMagicLink(page, request, USERS.client.email);
      await page.waitForURL(/\/consent\/pending/, { timeout: 30_000 });

      await page.goto("/dashboard");
      await page.waitForURL(/\/consent\/pending/, { timeout: 30_000 });
      await expect(
        page.getByRole("heading", { name: /consent preferences/i })
      ).toBeVisible();
    });

    test("settings revisit saves updated privacy preferences", async ({
      page,
      request,
    }) => {
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        restoreConsented: true,
      });

      await signInClientViaMagicLink(page, request, USERS.client.email);
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

      await page.goto("/settings");
      await expect(page.getByRole("heading", { name: /privacy/i })).toBeVisible({
        timeout: 15_000,
      });

      const nameField = page.locator('[data-pii-field="User.name"]');
      await nameField.getByText("Yes, allow").click();
      await page
        .getByRole("button", { name: /save preferences/i })
        .first()
        .click();

      await expect(page.getByText(/preferences updated/i)).toBeVisible({
        timeout: 15_000,
      });
    });

    test("advisor-disabled field is omitted from the consent prompt", async ({
      page,
      request,
    }) => {
      await prepareAdvisorPiiPolicy(request, {
        advisorEmail: USERS.advisor.email,
        fields: { "ClientProfile.phone": false },
      });

      try {
        await signInClientViaMagicLink(page, request, USERS.client.email);
        await page.waitForURL(/\/consent\/pending/, { timeout: 30_000 });

        await expect(
          page.locator('[data-pii-field="ClientProfile.phone"]')
        ).toHaveCount(0);
      } finally {
        await prepareAdvisorPiiPolicy(request, {
          advisorEmail: USERS.advisor.email,
          restoreDefault: true,
        });
      }
    });
  });

  test.describe("US-50 — advisor read-side redaction", () => {
    test.beforeEach(async ({ request }) => {
      await skipUnlessTestAuth(request);
    });

    test.afterEach(async ({ request }) => {
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        restoreConsented: true,
      });
    });

    test("pipeline shows client email instead of legal name when User.name consent is No", async ({
      page,
      request,
    }) => {
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        setFieldVisibility: { "User.name": false },
      });

      await new SignInPage(page).signInAs("advisor");
      await page.goto("/advisor/pipeline");
      await expect(
        page.getByRole("heading", { name: /pipeline overview/i })
      ).toBeVisible();

      const clientLink = page
        .getByRole("link")
        .filter({ hasText: USERS.client.email })
        .first();
      await expect(clientLink).toBeVisible({ timeout: 30_000 });
      await expect(clientLink.getByText(SEEDED_CLIENT_LEGAL_NAME)).toHaveCount(
        0
      );
      await expect(
        clientLink.locator(".font-medium").filter({ hasText: USERS.client.email })
      ).toBeVisible();
    });
  });

  test.describe("US-51 — field-fill consent (session 2.1)", () => {
    test.beforeEach(async ({ request }) => {
      await skipUnlessTestAuth(request);
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        restoreConsented: true,
      });
    });

    test.afterEach(async ({ request }) => {
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        restoreConsented: true,
      });
    });

    test("filling optional legal name grants advisor visibility", async ({
      page,
      request,
    }) => {
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        setFieldVisibility: { "User.name": false },
      });

      await signInClientViaMagicLink(page, request, USERS.client.email);
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

      await page.goto("/settings");
      await expect(page.getByTestId("client-optional-pii-form")).toBeVisible({
        timeout: 15_000,
      });

      const nameBlock = page.locator('[data-pii-field="User.name"]');
      await nameBlock.getByLabel(/client name/i).fill(SEEDED_CLIENT_LEGAL_NAME);
      await page.getByRole("button", { name: /save optional details/i }).click();
      await expect(page.getByText(/optional details saved/i)).toBeVisible({
        timeout: 15_000,
      });

      await signOutToSignIn(page);
      await new SignInPage(page).signInAs("advisor");
      await page.goto("/advisor/pipeline");
      await expect(
        page.getByRole("heading", { name: /pipeline overview/i })
      ).toBeVisible();

      const clientLink = page
        .getByRole("link")
        .filter({ hasText: SEEDED_CLIENT_LEGAL_NAME })
        .first();
      await expect(clientLink).toBeVisible({ timeout: 30_000 });
    });

    test("field fill writes client_pii.field_consent audit row", async ({
      page,
      request,
    }) => {
      await prepareClientConsent(request, {
        clientEmail: USERS.client.email,
        setFieldVisibility: { "User.name": false },
      });

      await signInClientViaMagicLink(page, request, USERS.client.email);
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

      await page.goto("/settings");
      await page
        .locator('[data-pii-field="User.name"]')
        .getByLabel(/client name/i)
        .fill(SEEDED_CLIENT_LEGAL_NAME);
      await page.getByRole("button", { name: /save optional details/i }).click();
      await expect(page.getByText(/optional details saved/i)).toBeVisible({
        timeout: 15_000,
      });

      await signOutToSignIn(page);
      await new SignInPage(page).signInAs("admin");
      const expanded = await expandAuditRowText(page, "client_pii.field_consent");
      expect(expanded).toContain("User.name");
      expect(expanded).toContain("field_fill");
    });
  });

  test.describe("US-50 — PII policy audit log", () => {
    test.beforeEach(async ({ request }) => {
      await skipUnlessTestAuth(request);
    });

    test("advisor policy toggle writes pii_policy.field_disable audit row", async ({
      page,
      request,
    }) => {
      await prepareAdvisorPiiPolicy(request, {
        advisorEmail: USERS.advisor.email,
        restoreDefault: true,
      });

      const signIn = new SignInPage(page);
      await signIn.signInAs("advisor");
      await page.goto("/advisor/settings/pii-policy");

      const phoneRow = page.locator('[data-pii-field="ClientProfile.phone"]');
      const phoneToggle = phoneRow.getByRole("checkbox");
      const wasChecked =
        (await phoneToggle.getAttribute("data-state")) === "checked";

      if (wasChecked) {
        await phoneToggle.click();
      }
      await page.getByRole("button", { name: /save policy/i }).click();
      await expect(page.getByText(/saved\./i)).toBeVisible({ timeout: 15_000 });

      try {
        await signOutToSignIn(page);
        await signIn.signInAs("admin");
        const expanded = await expandAuditRowText(
          page,
          "pii_policy.field_disable"
        );
        expect(expanded).toContain("ClientProfile.phone");
      } finally {
        await prepareAdvisorPiiPolicy(request, {
          advisorEmail: USERS.advisor.email,
          restoreDefault: true,
        });
      }
    });
  });
});
