import "server-only";

import { prisma } from "@/lib/db";

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

  const row = await delegate.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
    select: { mfaRequiredForAllRoles: true },
  });

  return row?.mfaRequiredForAllRoles ?? false;
}
