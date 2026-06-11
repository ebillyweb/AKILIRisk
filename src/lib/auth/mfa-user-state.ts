import "server-only";

import { prisma } from "@/lib/db";

export type MfaUserState = {
  mfaEnabled: boolean;
  mfaSecret: boolean;
};

/** Authoritative MFA flags from the database (not the JWT cookie). */
export async function getMfaUserState(userId: string): Promise<MfaUserState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaSecret: true },
  });
  if (!user) return null;
  return {
    mfaEnabled: user.mfaEnabled,
    mfaSecret: Boolean(user.mfaSecret),
  };
}
