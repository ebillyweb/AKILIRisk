import { test, expect } from "@playwright/test";
import { SignInPage } from "../page-objects/SignInPage";

/**
 * Coverage for the "Select all that apply (multi-choice)" answer type in the
 * admin assessment question bank.
 *
 * Feature surface:
 *  - List:   /admin/assessment/questions            (risk-area cards)
 *  - Area:   /admin/assessment/questions/[riskAreaId] (rows + New question link)
 *  - Create: /admin/assessment/questions/[riskAreaId]/new
 *  - Edit:   /admin/assessment/questions/[riskAreaId]/[questionId]
 *  - Fields component: src/components/admin/PillarQuestionBankFields.tsx
 *      answerType <select> option value "multi_select" labeled
 *      "Select all that apply (multi-choice)"; when persisted, the answer
 *      option inputs (answer0..answer3) are labeled Option 1..Option 4.
 *  - Server action createPillarQuestion validates answerType against a list
 *    that now includes "multi_select" and redirects to the area list with
 *    ?saved=1 ("Question bank changes are live for new assessments.").
 *
 * NOT tagged @smoke: this mutates the platform assessment question bank, so it
 * belongs in the full e2e run, not the 6-hourly canary. The test deletes the
 * question it creates so successive runs stay deterministic.
 */

// Assessment bank rows share the intake bank row layout.
const ROW_SELECTOR = "div.flex.flex-col.gap-3.p-4";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test.describe("admin assessment multi-select answer type", () => {
  test("admin can author a multi-select assessment question", async ({ page }) => {
    test.setTimeout(120_000);

    await new SignInPage(page).signInAs("admin");

    // 1. Land on the question bank and step into the first risk area.
    const indexResponse = await page.goto("/admin/assessment/questions");
    expect(indexResponse?.status()).toBe(200);

    await page
      .locator('[data-tour="config-primary-list"] a[href^="/admin/assessment/questions/"]')
      .first()
      .click();
    await page.waitForURL(/\/admin\/assessment\/questions\/[^/?]+$/);
    const areaPath = new URL(page.url()).pathname;
    const areaPathPattern = escapeRegExp(areaPath);

    // 2. Open the create form.
    await page.getByRole("link", { name: "New question" }).click();
    await page.waitForURL(new RegExp(`${areaPathPattern}/new$`));

    // Unique, bracket-free text: formatQuestionTextForDisplay strips trailing
    // [tag] markers, so avoid them to keep the displayed row text an exact match.
    const probeText = `PW multi-select smoke ${Date.now()}`;
    await page.locator("#text").fill(probeText);

    // Section is required; ensure a real (non-placeholder) section is selected.
    const sectionSelect = page.locator("#sectionId");
    const firstSectionValue = await sectionSelect
      .locator("option:not([disabled])")
      .first()
      .getAttribute("value");
    expect(firstSectionValue).toBeTruthy();
    await sectionSelect.selectOption(firstSectionValue!);

    // 3. Choose the multi-select answer type by its label, then fill options.
    await page
      .locator("#answerType")
      .selectOption({ label: "Select all that apply (multi-choice)" });
    await expect(page.locator("#answerType")).toHaveValue("multi_select");

    // The "Answer choices" section exposes the answer0..answer3 option inputs.
    // (The create form's field labels are rendered from the server-provided
    // answerType prop rather than live select state, so the multi-select
    // "Option N" labels are asserted on the edit page below, after the choice
    // persists.)
    await expect(page.getByText("Answer choices")).toBeVisible();
    await expect(page.locator("#answer0")).toBeVisible();
    await expect(page.locator("#answer1")).toBeVisible();
    await page.locator("#answer0").fill("MFA");
    await page.locator("#answer1").fill("Backups");

    // 4. Submit and confirm the save banner on the area list.
    await page.getByRole("button", { name: /create question/i }).click();
    await page.waitForURL(new RegExp(`${areaPathPattern}\\?saved=1`));
    await expect(
      page.getByText("Question bank changes are live for new assessments.")
    ).toBeVisible();

    // 5. Open the created question's edit page and verify the answer type
    // persisted as multi-select: the option labels ("Option 1"/"Option 2")
    // only render for answerType === "multi_select", and the option inputs
    // carry the values we authored.
    const createdRow = page.locator(ROW_SELECTOR, { hasText: probeText });
    await expect(createdRow).toHaveCount(1);
    await createdRow.getByRole("link", { name: /^edit$/i }).click();
    await page.waitForURL(new RegExp(`${areaPathPattern}/[^/?]+$`));

    await expect(page.locator("#text")).toHaveValue(probeText);
    await expect(page.getByText("Answer choices")).toBeVisible();
    await expect(page.getByText("Option 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Option 2", { exact: true })).toBeVisible();
    await expect(page.locator("#answer0")).toHaveValue("MFA");
    await expect(page.locator("#answer1")).toHaveValue("Backups");

    // 6. Cleanup: delete the created question via the admin UI so the bank is
    // restored. The delete button opens a window.confirm dialog.
    await page.goto(areaPath);
    const rowToDelete = page.locator(ROW_SELECTOR, { hasText: probeText });
    await expect(rowToDelete).toHaveCount(1);

    page.once("dialog", (dialog) => dialog.accept());
    await rowToDelete.getByRole("button", { name: /^delete$/i }).click();

    await expect(page.locator(ROW_SELECTOR, { hasText: probeText })).toHaveCount(0);
  });
});
