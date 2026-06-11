/**
 * Edge-safe helpers for mandatory password updates (no Node-only imports).
 */

import { matchesPathPrefix } from "@/lib/auth/mfa-gate";

export type PasswordChangeClaims = {
  passwordChangeRequired?: boolean;
};

export function isPasswordChangePending(
  claims: PasswordChangeClaims | null | undefined
): boolean {
  return Boolean(claims?.passwordChangeRequired);
}

export const PAGE_PASSWORD_CHANGE_EXEMPT_PREFIXES = [
  "/change-password",
  "/signin",
  "/signin/magic-link",
  "/signup",
  "/auth/",
  "/forgot-password",
  "/reset-password",
  "/api/auth/signout",
] as const;

export function isPagePasswordChangeExempt(pathname: string): boolean {
  return PAGE_PASSWORD_CHANGE_EXEMPT_PREFIXES.some((prefix) =>
    matchesPathPrefix(pathname, prefix)
  );
}

export function shouldBlockApiForPasswordChangePending(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/auth/")) return false;
  if (pathname.startsWith("/api/webhooks/")) return false;
  if (pathname.startsWith("/api/cron/")) return false;
  return true;
}
