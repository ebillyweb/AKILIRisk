import "server-only";

import { prisma } from "@/lib/db";

import {
  generateClientReferenceCode,
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
