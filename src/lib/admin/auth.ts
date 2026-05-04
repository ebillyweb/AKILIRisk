import "server-only";

import { auth } from "@/lib/auth";
import {
  DESIGNATED_ADMIN_EMAIL,
  isDesignatedAdminEmail,
} from "@/lib/auth-shared";

/** Re-export for back-compat with existing imports. The single source of
 *  truth is `DESIGNATED_ADMIN_EMAIL` in `@/lib/auth-shared`. */
export const ADMIN_ALLOWED_EMAIL = DESIGNATED_ADMIN_EMAIL;

export function isAdminUser(email: string | null | undefined, role: string | null | undefined): boolean {
  const r = role?.toString().toUpperCase();
  return r === "ADMIN" && isDesignatedAdminEmail(email);
}

/**
 * Require the current user to be the designated admin (ADMIN role and buddy@ebilly.com).
 * Use for admin-only routes and actions.
 */
export async function requireAdminRole() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  if (!isAdminUser(session.user.email ?? null, session.user.role)) {
    throw new Error("Unauthorized: Admin access is restricted to the designated admin account.");
  }

  return {
    userId: session.user.id,
    email: session.user.email,
  };
}
