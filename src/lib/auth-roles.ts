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
