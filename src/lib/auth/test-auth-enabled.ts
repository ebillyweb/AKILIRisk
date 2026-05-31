/**
 * Gate for test-only /api/test/* routes (magic-link issue, invitation issue,
 * password-reset latest).
 *
 * Requires ENABLE_TEST_AUTH=1. Blocks Vercel Production. Allows local dev and
 * Vercel Preview/Development (Next.js runs with NODE_ENV=production there).
 */
export function isTestAuthEnabled(): boolean {
  if (process.env.ENABLE_TEST_AUTH !== "1") return false;

  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return false;
  if (vercelEnv === "preview" || vercelEnv === "development") return true;

  return process.env.NODE_ENV !== "production";
}
