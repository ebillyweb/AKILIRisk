import "server-only";

import { prisma } from "@/lib/db";
import { isMfaChallengePending, type MfaJwtClaims } from "@/lib/auth/mfa-gate";

/**
 * Whether the user still owes an MFA challenge.
 *
 * `mfaEnabled` is read from the DB (authoritative opt-in). The verified state
 * comes from `claims.mfaVerified`, which the auth `jwt` callback recomputes from
 * the JWT's **bound** session row on every request. Earlier this re-read the
 * single newest-expiring session row, which could be a *different* login's row —
 * letting one session's verification satisfy the gate for another. We now stay
 * on the bound row (via the fresh claim) and fail closed when it isn't verified.
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

  // Fail closed: the bound-row verified state is carried on the (per-request
  // refreshed) claim; treat anything other than an explicit `true` as pending.
  return claims.mfaVerified !== true;
}
