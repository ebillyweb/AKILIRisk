import "server-only";

import { prisma } from "@/lib/db";
import { isPrismaSchemaDriftError } from "@/lib/db/schema-drift";

const PLATFORM_SETTINGS_ID = "default";

/**
 * Platform-wide toggle (legacy): MFA enrollment is optional for all roles.
 * This setting is no longer enforced; kept for schema compatibility.
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
