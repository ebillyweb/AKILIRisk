import "server-only";

import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import {
  isPlatformAdminRole,
  isSuperAdminRole,
  normalizeUserRoleString,
} from "@/lib/auth-roles";
import { DESIGNATED_ADMIN_EMAIL } from "@/lib/auth-shared";
import { assertMfaVerified } from "@/lib/auth/require-mfa-verified";

/** Re-export for back-compat with existing imports. */
export const ADMIN_ALLOWED_EMAIL = DESIGNATED_ADMIN_EMAIL;

export type PlatformAdminContext = {
  userId: string;
  email: string | null | undefined;
  /** Uppercased `UserRole` string from the session (JWT). */
  role: string;
};

/**
 * True if the session user may access the platform admin UI (`/admin`) and
 * `requireAdminRole` actions — `ADMIN` or `SUPER_ADMIN`.
 */
export function isAdmin(session: Session | null): boolean {
  return isPlatformAdminRole(session?.user?.role);
}

/**
 * True if the session user is a super admin (platform-wide settings, etc.).
 */
export function isSuperAdmin(session: Session | null): boolean {
  return isSuperAdminRole(session?.user?.role);
}

/**
 * @deprecated Use {@link isAdmin} with the full session object.
 */
export function isAdminUser(
  _email: string | null | undefined,
  role: string | null | undefined
): boolean {
  return isPlatformAdminRole(role);
}

/**
 * Require `ADMIN` or `SUPER_ADMIN`. Use for almost all `/admin` pages and
 * admin server actions. For platform-wide settings, use
 * {@link requireSuperAdminRole} instead.
 */
export async function requireAdminRole(): Promise<PlatformAdminContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  if (!isAdmin(session)) {
    throw new Error(
      "Unauthorized: Admin access requires ADMIN or SUPER_ADMIN role."
    );
  }

  await assertMfaVerified(session);

  return {
    userId: session.user.id,
    email: session.user.email,
    role: normalizeUserRoleString(session.user.role),
  };
}

/**
 * Require `SUPER_ADMIN` only (platform feature flags, global risk thresholds).
 */
export async function requireSuperAdminRole(): Promise<PlatformAdminContext> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  if (!isSuperAdmin(session)) {
    throw new Error(
      "Unauthorized: This action requires the SUPER_ADMIN role."
    );
  }

  await assertMfaVerified(session);

  return {
    userId: session.user.id,
    email: session.user.email,
    role: normalizeUserRoleString(session.user.role),
  };
}
