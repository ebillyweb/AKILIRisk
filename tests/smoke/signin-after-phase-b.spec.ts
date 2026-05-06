import { test, expect } from "@playwright/test";
import { USERS } from "../fixtures/users";

/**
 * Round-11 commit 2.4a (BRD §5.1.AUTH / phase B — soft-drop step 1):
 * end-to-end signin smoke that exercises the post-flip auth path.
 *
 * After 2.4a the User table's authoritative auth-path lookup column
 * is `emailCiphertext`. This spec confirms:
 *
 *   1. Magic-link issuance still works for an existing client whose
 *      row was backfilled in 2.3 (the test endpoint computes the
 *      ciphertext via the same helper used at write time).
 *
 *   2. The verify-link round-trip lands on /dashboard — so the
 *      magic-link auth provider successfully looked up the user via
 *      the new ciphertext-only `findUserByEmail`.
 *
 *   3. `session.user.email` resolves to the original plaintext email
 *      (returned by the dashboard's "signed in as" affordance), which
 *      proves the NextAuth credentials path is sourcing email from
 *      the form-input plaintext (not from the dropped @unique
 *      column) — i.e. display surfaces are unaffected by the flip.
 *
 * If this fails: check ENABLE_TEST_AUTH=1 on the target deployment,
 * then run the rollback rehearsal (see commit 2.4a's checklist).
 */
test.describe("signin after phase-B flip", () => {
  test("magic-link issue → verify → dashboard, session.user.email is the original plaintext", async ({
    page,
  }) => {
    const expectedEmail = USERS.client.email;

    // (1) Issue a magic-link for the client. The endpoint goes through
    //     issueMagicLinkToken which now stores under the ciphertext key.
    const res = await page.request.post("/api/test/magic-link/issue", {
      data: { email: expectedEmail },
    });
    if (res.status() === 404) {
      throw new Error(
        "Test endpoint returned 404 — confirm ENABLE_TEST_AUTH=1 on the target deployment."
      );
    }
    expect(res.ok()).toBe(true);
    const { verifyUrl } = await res.json();

    // (2) Hit the verify URL — this exercises the magic-link credentials
    //     provider → findUserByEmail → emailCiphertext lookup → session
    //     creation. Strip origin to match the Playwright baseURL.
    const u = new URL(verifyUrl);
    await page.goto(u.pathname + u.search);

    // (3) Verify-success redirects to the client's expected landing page.
    await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 30_000 });

    // (4) Confirm session.user.email surfaces the original plaintext.
    //     The protected layout renders it in the user-menu dropdown —
    //     visible somewhere in the DOM after signin.
    await expect(page.getByText(expectedEmail).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
