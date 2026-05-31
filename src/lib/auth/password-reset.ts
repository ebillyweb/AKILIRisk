import crypto from "crypto";
import { prisma } from "@/lib/db";

export type IssuedPasswordResetToken = {
  rawToken: string;
  expires: Date;
};

/**
 * Create a single-use password-reset token for an advisor/admin account.
 * Mirrors the persistence logic in /api/auth/forgot-password — raw token
 * is returned to the caller; only the SHA-256 hash is stored.
 */
export async function issuePasswordResetToken(
  email: string
): Promise<IssuedPasswordResetToken> {
  const normalizedEmail = email.trim().toLowerCase();

  await prisma.verificationToken.deleteMany({
    where: {
      identifier: normalizedEmail,
      expires: { gt: new Date() },
    },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token: hashedToken,
      expires,
    },
  });

  return { rawToken, expires };
}
