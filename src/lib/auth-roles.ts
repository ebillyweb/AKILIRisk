/**
 * Platform user roles (matches Prisma `UserRole`). Pure helpers — safe for
 * Edge middleware and client components (no Prisma / Node-only imports).
 */

export const USER_ROLES = [
  "USER",
  "ADVISOR",
  "ADMIN",
  "SUPER_ADMIN",
] as const;

export type CanonicalUserRole = (typeof USER_ROLES)[number];

export function normalizeUserRoleString(
  raw: string | null | undefined
): CanonicalUserRole {
  const r = (raw ?? "USER").toString().toUpperCase();
  if (
    r === "SUPER_ADMIN" ||
    r === "ADMIN" ||
    r === "ADVISOR" ||
    r === "USER"
  ) {
    return r;
  }
  return "USER";
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return normalizeUserRoleString(role) === "SUPER_ADMIN";
}

/** `ADMIN` or `SUPER_ADMIN` — AKILI / platform staff admin UI. */
export function isPlatformAdminRole(role: string | null | undefined): boolean {
  const r = normalizeUserRoleString(role);
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

/**
 * Roles that may use advisor-hub navigation and advisor-scoped APIs when
 * other gates pass (subscription, portal flag, etc.).
 */
export function isAdvisorHubNavRole(role: string | null | undefined): boolean {
  const r = normalizeUserRoleString(role);
  return r === "ADVISOR" || r === "ADMIN" || r === "SUPER_ADMIN";
}

/**
 * Canonical home for a non-client role that lands on the client portal
 * (`/dashboard`). Platform admins → `/admin`, advisor-hub roles → `/advisor`,
 * clients (`USER`) → `null` (they stay on the client dashboard).
 *
 * Used by the proxy to redirect advisor/admin roles off `/dashboard` before the
 * client shell renders. `/advisor` and `/admin` enforce their own access gates.
 */
export function clientHomeRedirectTargetForRole(
  role: string | null | undefined
): "/admin" | "/advisor" | null {
  const r = normalizeUserRoleString(role);
  if (isPlatformAdminRole(r)) return "/admin";
  if (isAdvisorHubNavRole(r)) return "/advisor";
  return null;
}
