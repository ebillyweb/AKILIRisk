import { WORKSPACE_PATH_PREFIXES } from "@/lib/auth/mfa-gate";

/** Public/auth/marketing routes on tenant hosts that stay on the main app tree. */
export const TENANT_PUBLIC_PREFIXES = [
  "/signup",
  "/signin",
  "/consent",
  "/mfa",
  "/forgot-password",
  "/reset-password",
  "/request-review",
  "/start",
  "/pricing",
  "/terms",
  "/privacy",
  "/about",
  "/contact",
] as const;

/**
 * Tenant subdomain paths that must NOT rewrite to `/branded/*`.
 * Keep in sync with client/advisor workspace routes (`WORKSPACE_PATH_PREFIXES`).
 */
export const TENANT_PASS_THROUGH_PREFIXES = [
  ...TENANT_PUBLIC_PREFIXES,
  ...WORKSPACE_PATH_PREFIXES,
] as const;

export function isTenantPassThroughPath(pathname: string): boolean {
  return TENANT_PASS_THROUGH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}
