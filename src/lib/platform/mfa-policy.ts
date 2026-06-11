import "server-only";

import { prisma } from "@/lib/db";
import { isPrismaSchemaDriftError } from "@/lib/db/schema-drift";

const PLATFORM_SETTINGS_ID = "default";

/**
 * Platform-wide toggle: when true, client (USER) accounts must also enroll in MFA.
 * Staff roles (ADVISOR, ADMIN, SUPER_ADMIN) always require MFA regardless.
 */
export async function getMfaRequiredForAllRoles(): Promise<boolean> {
  const delegate = prisma.platformSettings as
    | typeof prisma.platformSettings
    | undefined;
  if (!delegate?.findUnique) {
    return false;
  }

  try {
    const row = await delegate.findUnique({
      where: { id: PLATFORM_SETTINGS_ID },
      select: { mfaRequiredForAllRoles: true },
    });
    return row?.mfaRequiredForAllRoles ?? false;
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      console.warn(
        "[mfa-policy] mfaRequiredForAllRoles column missing — run `npx prisma migrate deploy`. Defaulting to false."
      );
      return false;
    }
    throw error;
  }
}
