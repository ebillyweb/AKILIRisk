import "server-only";

import { prisma } from "@/lib/db";
import { isPrismaSchemaDriftError } from "@/lib/db/schema-drift";

export type UserAuthSnapshot = {
  mfaEnabled: boolean;
  role: string;
  firstName: string | null;
  deletedAt: Date | null;
  passwordChangeRequired: boolean;
  passwordPolicyRevision: number;
};

const baseSelect = {
  mfaEnabled: true,
  role: true,
  firstName: true,
  deletedAt: true,
} as const;

const complianceSelect = {
  ...baseSelect,
  passwordChangeRequired: true,
  passwordPolicyRevision: true,
} as const;

/**
 * Load JWT/session auth fields, falling back when compliance columns are
 * not yet migrated on the target database.
 */
export async function getUserAuthSnapshot(
  userId: string
): Promise<UserAuthSnapshot | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: complianceSelect,
    });
    if (!user) return null;
    return {
      mfaEnabled: user.mfaEnabled,
      role: user.role.toString().toUpperCase(),
      firstName: user.firstName,
      deletedAt: user.deletedAt,
      passwordChangeRequired: user.passwordChangeRequired,
      passwordPolicyRevision: user.passwordPolicyRevision,
    };
  } catch (error) {
    if (!isPrismaSchemaDriftError(error)) {
      throw error;
    }

    console.warn(
      "[auth] User compliance columns missing — run `npx prisma migrate deploy`. Using safe defaults."
    );

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: baseSelect,
    });
    if (!user) return null;

    return {
      mfaEnabled: user.mfaEnabled,
      role: user.role.toString().toUpperCase(),
      firstName: user.firstName,
      deletedAt: user.deletedAt,
      passwordChangeRequired: false,
      passwordPolicyRevision: 0,
    };
  }
}

export async function syncPasswordChangeRequired(
  userId: string,
  required: boolean
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordChangeRequired: required },
    });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      return;
    }
    throw error;
  }
}

export async function syncPasswordPolicyRevision(
  userId: string,
  revision: number
): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordPolicyRevision: revision },
    });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      return;
    }
    throw error;
  }
}
