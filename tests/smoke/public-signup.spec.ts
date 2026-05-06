/**
 * RETIRED — round-11 session-2.
 *
 * This file used to cover the public-signup happy path: visit /start,
 * redeem an invite code, complete the password-based /signup form,
 * land on /intake. Round-11 commit 219c52e removed both the password
 * signup form and the credentials sign-in path for clients (clients
 * authenticate via magic link only — see BRD §5.1.AUTH amendment).
 *
 * The flow this spec exercised no longer exists. The replacement —
 * "advisor invite → magic-link → User created on click" — is deferred
 * to a follow-up commit; once that user-creation logic lands, a fresh
 * smoke covering the new flow will replace this file.
 *
 * The file is preserved as an empty test.describe (rather than
 * deleted) only because the staging sandbox couldn't unlink a
 * host-owned file in this commit. Safe to delete with `rm` next time
 * someone touches the suite.
 */

import { test } from "@playwright/test";

test.describe.skip("public signup (retired post-round-11)", () => {
  // Empty on purpose. Playwright collects zero tests from this block.
});
