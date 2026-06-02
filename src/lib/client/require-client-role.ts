import "server-only";

import { NextResponse } from "next/server";

import {
  isPlatformAdminRole,
  normalizeUserRoleString,
} from "@/lib/auth-roles";

/** True when the account is a household client (`UserRole.USER`), not staff/advisor. */
export function isClientUserRole(role: string | null | undefined): boolean {
  return normalizeUserRoleString(role) === "USER";
}

/** Where non-clients should land when they hit a client-only route. */
export function redirectPathUnlessClientRole(
  role: string | null | undefined,
): string | null {
  if (isClientUserRole(role)) return null;

  const r = normalizeUserRoleString(role);
  if (r === "ADVISOR") return "/advisor";
  if (isPlatformAdminRole(r)) return "/admin";
  return "/dashboard";
}

/** Used by client-only server actions (intake, household, etc.). */
export function requireClientUserRole(role: string | null | undefined): void {
  if (!isClientUserRole(role)) {
    throw new Error("Unauthorized: Client access required");
  }
}

export function clientRoleForbiddenJsonResponse(): NextResponse {
  return NextResponse.json(
    { success: false, error: "Client access required" },
    { status: 403 },
  );
}

/**
 * For intake mutation APIs. Returns 403 when the session is not a client.
 * Caller must still enforce authentication (401) separately.
 */
export function assertClientRoleForMutationApi(session: {
  user?: { role?: string | null } | null;
} | null): NextResponse | null {
  if (!session?.user) return null;
  if (!isClientUserRole(session.user.role)) {
    return clientRoleForbiddenJsonResponse();
  }
  return null;
}
