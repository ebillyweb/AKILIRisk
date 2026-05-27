import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

/**
 * Marks an invited administrator as verified on first successful sign-in.
 * Returns true when emailVerified was set in this call.
 */
export async function verifyAdminEmailOnFirstSignIn(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      emailVerified: true,
      emailCiphertext: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) return false;
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") return false;
  if (user.emailVerified) return false;

  const verifiedAt = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: verifiedAt },
  });

  await writeAudit({
    actor: {
      userId: user.id,
      role: user.role,
      emailCiphertext: user.emailCiphertext,
    },
    action: AUDIT_ACTIONS.ADMIN_USER_EMAIL_VERIFIED,
    entityType: "User",
    entityId: user.id,
    beforeData: { emailVerified: null },
    afterData: { emailVerified: verifiedAt.toISOString() },
    metadata: { source: "first_sign_in" },
  });

  return true;
}
