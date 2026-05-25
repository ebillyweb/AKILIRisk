import "server-only";

import { prisma } from "@/lib/db";
import { isMfaChallengePending, type MfaJwtClaims } from "@/lib/auth/mfa-gate";

/**
 * Whether the user still owes an MFA challenge, reconciling JWT claims with
 * the database session row. After TOTP/recovery verify we set
 * `Session.mfaVerified=true` immediately, but the JWT cookie can remain stale
 * until the next sign-in — treat the DB as authoritative when JWT says pending.
 */
export async function isMfaChallengePendingForUser(
  claims: MfaJwtClaims & { id?: string }
): Promise<boolean> {
  if (!isMfaChallengePending(claims)) {
    return false;
  }

  const userId = claims.id;
  if (!userId) {
    return true;
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
