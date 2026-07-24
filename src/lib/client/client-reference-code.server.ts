import "server-only";

import { prisma } from "@/lib/db";

import {
  generateClientReferenceCode,
  validateCustomClientReferenceCode,
  normalizeCustomClientReferenceCode,
} from "@/lib/client/client-reference-code";

export async function ensureClientReferenceCode(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { clientReferenceCode: true },
  });
  if (existing?.clientReferenceCode) {
    return existing.clientReferenceCode;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateClientReferenceCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { clientReferenceCode: candidate },
        select: { clientReferenceCode: true },
      });
      return updated.clientReferenceCode!;
    } catch {
      // Unique collision — retry with a new code.
    }
  }

  throw new Error(`Failed to assign client reference code for user ${userId}`);
}

/** Returns the stored reference code or assigns one before display. */
export async function resolveClientReferenceCode(
  userId: string,
  existing: string | null | undefined,
): Promise<string> {
  if (existing?.trim()) {
    return existing.trim();
  }
  return ensureClientReferenceCode(userId);
}

export type SetCustomClientReferenceCodeResult =
  | { success: true; code: string }
  | { success: false; error: string };

/**
 * Set a custom client reference code for a user.
 * Returns error if the code is invalid or already in use.
 */
export async function setCustomClientReferenceCode(
  userId: string,
  customCode: string,
): Promise<SetCustomClientReferenceCodeResult> {
  const validationError = validateCustomClientReferenceCode(customCode);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const normalized = normalizeCustomClientReferenceCode(customCode);

  const existingUser = await prisma.user.findFirst({
    where: {
      clientReferenceCode: normalized,
      id: { not: userId },
    },
    select: { id: true },
  });

  if (existingUser) {
    return { success: false, error: "This Client ID is already in use" };
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { clientReferenceCode: normalized },
      select: { clientReferenceCode: true },
    });
    return { success: true, code: updated.clientReferenceCode! };
  } catch {
    return { success: false, error: "Failed to update Client ID" };
  }
}

/**
 * Check if a client reference code is available (not already in use).
 */
export async function isClientReferenceCodeAvailable(
  code: string,
  excludeUserId?: string,
): Promise<boolean> {
  const normalized = normalizeCustomClientReferenceCode(code);
  const existing = await prisma.user.findFirst({
    where: {
      clientReferenceCode: normalized,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return !existing;
}
