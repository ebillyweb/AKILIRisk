import "server-only";

import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin/auth";
import { normalizeUserRoleString } from "@/lib/auth-roles";

/**
 * Audit-log routes use 404-for-non-admin (existence-leak avoidance, same
 * posture as the audio streaming route). Returns the admin actor info on
 * success; returns null when the caller is not a platform admin —
 * caller decides between `notFound()` (page) and a 404 NextResponse (API).
 *
 * Distinct from `requireAdminRole()` which throws an "Unauthorized" Error.
 * For the audit log, we want silence on the wire, not a thrown error that
 * confirms the path exists.
 */
export async function getAuditAdminActorOrNull(): Promise<{
  userId: string;
  email: string | null;
  role: string;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!isAdmin(session)) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    role: normalizeUserRoleString(session.user.role),
  };
}
