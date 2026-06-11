/**
 * Edge-safe MFA gate helpers (no Node-only imports).
 *
 * Used by `src/proxy.ts` for API enforcement and by server layouts via
 * `redirectIfMfaChallengePending`. US-48: a session with MFA enabled is
 * not fully authorized until `mfaVerified` is true.
 */

import { isMfaEnrollmentPending } from "@/lib/auth/mfa-enforcement";

export type MfaJwtClaims = {
  mfaEnabled?: boolean;
  mfaVerified?: boolean;
  mfaEnrollmentRequired?: boolean;
};

export function isMfaChallengePending(
  claims: MfaJwtClaims | null | undefined
): boolean {
  if (!claims) return false;
  return Boolean(claims.mfaEnabled) && !Boolean(claims.mfaVerified);
}

export function isMfaSetupPending(
  claims: MfaJwtClaims | null | undefined
): boolean {
  return isMfaEnrollmentPending(claims);
}

/**
 * Authenticated workspace pages under `(protected)` and related app surfaces.
 * Used by the proxy for early MFA redirects (layout also enforces).
 */
export const WORKSPACE_PATH_PREFIXES = [
  "/dashboard",
  "/assessment",
  "/settings",
  "/admin",
  "/advisor",
  "/intake",
  "/consent",
  "/profiles",
  "/documents",
  "/family",
] as const;

export function matchesPathPrefix(
  pathname: string,
  prefix: string
): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isWorkspacePath(pathname: string): boolean {
  return WORKSPACE_PATH_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix)
  );
}

/** Pages reachable while MFA is enabled but not yet verified. */
export const PAGE_MFA_EXEMPT_PREFIXES = [
  "/mfa/verify",
  "/mfa/setup",
  "/signin",
  "/signin/magic-link",
  "/signup",
  "/auth/",
  "/forgot-password",
  "/reset-password",
  "/change-password",
  "/api/auth/signout",
] as const;

export function isPageMfaExempt(pathname: string): boolean {
  return PAGE_MFA_EXEMPT_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix)
  );
}

/**
 * API routes that must stay reachable during the MFA challenge (sign-in
 * plumbing + completing the challenge itself).
 */
export const API_MFA_EXEMPT_PREFIXES = [
  "/api/auth/",
  "/api/webhooks/",
  "/api/cron/",
] as const;

const API_MFA_EXEMPT_EXACT = ["/api/invite/prefill"] as const;

export function isApiMfaExempt(pathname: string): boolean {
  if (API_MFA_EXEMPT_EXACT.some((path) => pathname === path)) {
    return true;
  }
  return API_MFA_EXEMPT_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
}

export function shouldBlockApiForMfaPending(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  return !isApiMfaExempt(pathname);
}

export function shouldBlockApiForMfaSetupPending(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (isApiMfaExempt(pathname)) return false;
  if (pathname.startsWith("/api/auth/mfa/")) return false;
  return true;
}
