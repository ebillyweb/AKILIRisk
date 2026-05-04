import "server-only";

import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin/auth";

/**
 * Audit-log routes use 404-for-non-admin (existence-leak avoidance, same
 * posture as the audio streaming route). Returns the admin actor info on
 * success; returns null when the caller is not the designated admin —
 * caller decides between `notFound()` (page) and a 404 NextResponse (API).
 *
 * Distinct from `requireAdminRole()` which throws an "Unauthorized" Error.
 * For the audit log, we want silence on the wire, not a thrown error that
 * confirms the path exists.
 */
export async function getAuditAdminActorOrNull(): Promise<{
  userId: string;
  email: string | null;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!isAdminUser(session.user.email ?? null, session.user.role)) return null;
  return {
    userId: session.user.id,
    email: session.user.email ?? null,
  };
}
