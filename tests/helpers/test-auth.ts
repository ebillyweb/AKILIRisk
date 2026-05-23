import { test, type APIRequestContext } from "@playwright/test";
import { USERS } from "../fixtures/users";

export const TEST_AUTH_SKIP_REASON =
  "ENABLE_TEST_AUTH=1 required on the target deployment (see .env.example).";

/**
 * Returns true when test-only API routes (/api/test/*) are available.
 */
export async function isTestAuthEnabled(
  request: APIRequestContext
): Promise<boolean> {
  const res = await request.post("/api/test/magic-link/issue", {
    data: { email: USERS.client.email },
  });
  return res.status() !== 404;
}

/** Call from test.beforeEach when the suite depends on /api/test/*. */
export async function skipUnlessTestAuth(
  request: APIRequestContext
): Promise<void> {
  if (!(await isTestAuthEnabled(request))) {
    test.skip(true, TEST_AUTH_SKIP_REASON);
  }
}
