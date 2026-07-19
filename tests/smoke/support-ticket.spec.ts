import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Support ticket canary — UI + attachment only.
 *
 * Intentionally does NOT submit the form: preview has a live Resend key, and
 * we must not send real mail from scheduled smoke. Email payload construction
 * (including attachments) is covered by
 * `src/lib/email/support-ticket.send.test.ts` with Resend mocked.
 */

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test.describe("support ticket form", () => {
  test(
    "advisor can open Support and attach a document screenshot without sending",
    { tag: "@smoke" },
    async ({ page }) => {
      const signIn = new SignInPage(page);
      await signIn.signInAs("advisor");

      await page.goto("/support");
      await expect(page.getByTestId("support-form")).toBeVisible();
      await expect(page.getByTestId("support-form-category")).toBeVisible();
      await expect(page.getByTestId("support-form-subject")).toBeVisible();
      await expect(page.getByTestId("support-form-attachment-dropzone")).toBeVisible();

      await page.getByTestId("support-form-category").click();
      await page.getByRole("option", { name: /Technical issue/i }).click();
      await page
        .getByTestId("support-form-subject")
        .fill("Smoke: document screenshot attach");
      await page
        .locator("#support-message")
        .fill(
          "Smoke test only — verifying attachment UI. Do not submit this ticket."
        );

      await page.getByTestId("support-form-attachment").setInputFiles({
        name: "doc-shot.png",
        mimeType: "image/png",
        buffer: TINY_PNG,
      });

      await expect(page.getByText("doc-shot.png")).toBeVisible();
      await expect(page.getByAltText("Attachment preview")).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Submit ticket/i })
      ).toBeVisible();

      // Explicit non-send: leave the form filled; never click submit.
    }
  );
});
