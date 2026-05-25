import "server-only";

import { auth } from "@/lib/auth";
import { isPlatformAdminRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/db";

export type PolicyDocumentAccess =
  | { ok: false; status: 401 | 404 }
  | {
      ok: true;
      clientUserId: string;
      /** Set when caller is an active-assigned advisor (for branded docs). */
      advisorProfileId: string | null;
      /** Advisor-facing household view (shared members only). */
      advisorView: boolean;
    };

/**
 * US-62: assessment owner, active-assigned advisor, or platform admin.
 * Unauthorized callers receive 404 (no assessment id probing).
 */
export async function resolvePolicyDocumentAccess(
  assessmentId: string
): Promise<PolicyDocumentAccess> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, status: 401 };
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { userId: true },
  });
  if (!assessment) {
    return { ok: false, status: 404 };
  }

  const sessionUserId = session.user.id;
  const sessionRole = session.user.role?.toString().toUpperCase();
  const isOwner = assessment.userId === sessionUserId;
  const isAdmin = isPlatformAdminRole(sessionRole);

  if (isOwner) {
    return {
      ok: true,
      clientUserId: assessment.userId,
      advisorProfileId: null,
      advisorView: false,
    };
  }

  if (isAdmin) {
    return {
      ok: true,
      clientUserId: assessment.userId,
      advisorProfileId: null,
      advisorView: false,
    };
  }

  if (sessionRole === "ADVISOR") {
    const advisorProfile = await prisma.advisorProfile.findUnique({
      where: { userId: sessionUserId },
      select: { id: true },
    });
    if (!advisorProfile) {
      return { ok: false, status: 404 };
    }

    const assignment = await prisma.clientAdvisorAssignment.findFirst({
      where: {
        advisorId: advisorProfile.id,
        clientId: assessment.userId,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!assignment) {
      return { ok: false, status: 404 };
    }

    return {
      ok: true,
      clientUserId: assessment.userId,
      advisorProfileId: advisorProfile.id,
      advisorView: true,
    };
  }

  return { ok: false, status: 404 };
}
