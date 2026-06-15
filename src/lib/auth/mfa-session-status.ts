import "server-only";

import { prisma } from "@/lib/db";
import { isMfaChallengePending, type MfaJwtClaims } from "@/lib/auth/mfa-gate";

/**
 * Whether the user still owes an MFA challenge.
 *
 * Uses the database as source of truth: only users who opted in (`mfaEnabled`)
 * are challenged. Stale JWT `mfaEnabled` / `mfaEnrollmentRequired` claims do
 * not force MFA. Session `mfaVerified` is authoritative over JWT `mfaVerified`.
 */
export async function isMfaChallengePendingForUser(
  claims: MfaJwtClaims & { id?: string }
): Promise<boolean> {
  const userId = claims.id ?? (claims as { sub?: string }).sub;
  if (!userId) {
    return isMfaChallengePending(claims);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true },
  });

  if (!user?.mfaEnabled) {
    return false;
  }

  const [session] = await prisma.session.findMany({
    where: {
      userId,
      expires: { gt: new Date() },
    },
    orderBy: { expires: "desc" },
    take: 1,
    select: { mfaVerified: true },
  });

  return !session?.mfaVerified;
}
