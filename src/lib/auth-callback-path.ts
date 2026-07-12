import {
  isAdvisorHubNavRole,
  isPlatformAdminRole,
  normalizeUserRoleString,
} from "@/lib/auth-roles";
import { matchesPathPrefix } from "@/lib/auth/mfa-gate";
import { stripTenantPathPrefix } from "@/lib/client/tenant-path-prefix-client";

/** Paths any authenticated role may return to after sign-in / MFA. */
const POST_SIGN_IN_NEUTRAL_PREFIXES = [
  "/change-password",
  "/mfa/",
  "/enterprise/join",
] as const;

/**
 * Drop one-shot notice params that must not survive another login hop.
 * Preserves all other query keys (e.g. invite tokens).
 */
export function stripSpuriousCallbackQuery(raw: string): string {
  const qIndex = raw.indexOf("?");
  if (qIndex === -1) return raw;

  const path = raw.slice(0, qIndex);
  const params = new URLSearchParams(raw.slice(qIndex + 1));
  if (params.get("error") === "unauthorized") {
    params.delete("error");
  }

  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

export function defaultPostSignInPathForRole(
  role: string | null | undefined,
): string {
  const normalized = normalizeUserRoleString(role);
  if (isPlatformAdminRole(normalized)) return "/admin";
  if (normalized === "ADVISOR") return "/advisor";
  return "/dashboard";
}

export function isPostSignInPathAllowedForRole(
  rawPath: string,
  role: string | null | undefined,
): boolean {
  if (!rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return false;
  }

  const pathOnly = stripTenantPathPrefix(rawPath.split("?")[0] ?? rawPath);
  const normalized = normalizeUserRoleString(role);

  if (
    POST_SIGN_IN_NEUTRAL_PREFIXES.some((prefix) =>
      matchesPathPrefix(pathOnly, prefix),
    )
  ) {
    return true;
  }

  if (pathOnly.startsWith("/admin")) {
    return isPlatformAdminRole(normalized);
  }

  if (pathOnly.startsWith("/advisor")) {
    return isAdvisorHubNavRole(normalized);
  }

  if (normalized === "USER") {
    return (
      !pathOnly.startsWith("/admin") && !pathOnly.startsWith("/advisor")
    );
  }

  return true;
}

/**
 * Role-aware post-credentials destination. Honors callbackUrl only when the
 * signed-in role may access that workspace; strips stale `error=unauthorized`.
 */
export function resolvePostSignInPath(
  callbackUrl: string | null | undefined,
  role: string | null | undefined,
): string {
  const fallback = defaultPostSignInPathForRole(role);

  if (
    !callbackUrl ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//")
  ) {
    return fallback;
  }

  const cleaned = stripSpuriousCallbackQuery(callbackUrl);
  if (!isPostSignInPathAllowedForRole(cleaned, role)) {
    return fallback;
  }

  return cleaned;
}

/**
 * Post-auth redirect target: same-origin relative paths only (open-redirect safe).
 * Strips stale `error=unauthorized` notice params.
 */
export function safeAfterSignInPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return stripSpuriousCallbackQuery(raw);
}
