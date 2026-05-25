import type { APIRequestContext } from "@playwright/test";

import { USERS } from "../fixtures/users";
import { TEST_AUTH_SKIP_REASON } from "./test-auth";

/** Advisor used for soft-delete smokes — avoids touching advisor@test.com. */
export const DEACTIVATE_TEST_ADVISOR = USERS.advisor2;

async function postDeactivate(
  request: APIRequestContext,
  email: string,
  restoreOnly: boolean
): Promise<Response> {
  return request.post("/api/test/user/deactivate", {
    data: { email, restoreOnly },
  });
}

export async function deactivateTestUser(
  request: APIRequestContext,
  email: string = DEACTIVATE_TEST_ADVISOR.email
): Promise<void> {
  const res = await postDeactivate(request, email, false);
  if (res.status() === 404) {
    throw new Error(TEST_AUTH_SKIP_REASON);
  }
  if (!res.ok()) {
    throw new Error(
      `Deactivate failed: ${res.status()} ${await res.text()}`
    );
  }
}

export async function restoreTestUser(
  request: APIRequestContext,
  email: string = DEACTIVATE_TEST_ADVISOR.email
): Promise<void> {
  const res = await postDeactivate(request, email, true);
  if (res.status() === 404) {
    return;
  }
  if (!res.ok()) {
    throw new Error(`Restore failed: ${res.status()} ${await res.text()}`);
  }
}

/** Complete NextAuth sign-out when redirected to the confirmation page. */
export async function completeSignOutIfPrompted(
  page: import("@playwright/test").Page
): Promise<void> {
  const signOutButton = page.getByRole("button", { name: /^sign out$/i });
  if (await signOutButton.isVisible().catch(() => false)) {
    await signOutButton.click();
  }
}
