import "server-only";

import { randomBytes, randomInt } from "crypto";
import { prisma } from "@/lib/db";

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes
const CODE_PREFIX = "code:"; // distinguishes the 6-digit code row from the link token

export interface MagicLinkArtifacts {
  linkToken: string;
  code: string;
}

/**
 * Creates a one-time magic-link token and a 6-digit paste-code for an email,
 * persisting both in VerificationToken. Any prior tokens for the email are
 * cleared so only the latest is valid.
 */
export async function createMagicLink(email: string): Promise<MagicLinkArtifacts> {
  const identifier = email.toLowerCase();
  const linkToken = randomBytes(32).toString("base64url");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expires = new Date(Date.now() + MAGIC_LINK_TTL_MS);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.createMany({
      data: [
        { identifier, token: linkToken, expires },
        { identifier, token: `${CODE_PREFIX}${code}`, expires },
      ],
    }),
  ]);

  return { linkToken, code };
}

/** Consumes a magic-link token. Returns the email (identifier) or null. */
export async function consumeLinkToken(token: string): Promise<string | null> {
  return consumeToken(token);
}

/** Consumes a 6-digit code for a given email. Returns the email or null. */
export async function consumeCode(email: string, code: string): Promise<string | null> {
  const identifier = email.toLowerCase();
  const row = await prisma.verificationToken.findFirst({
    where: { identifier, token: `${CODE_PREFIX}${code}` },
  });
  if (!row) return null;
  return consumeToken(row.token);
}

async function consumeToken(token: string): Promise<string | null> {
  const row = await prisma.verificationToken.findUnique({ where: { token } });
  if (!row) return null;

  // Atomic single-use: only the winner of a concurrent race flips used=false→true
  // for an unexpired row. This closes the read-check-write TOCTOU where two
  // requests could both consume the same token/code.
  const claimed = await prisma.verificationToken.updateMany({
    where: { token, used: false, expires: { gt: new Date() } },
    data: { used: true },
  });
  if (claimed.count === 0) return null;

  // Winner clears the remaining sibling tokens for the identifier.
  await prisma.verificationToken.deleteMany({
    where: { identifier: row.identifier, used: false },
  });
  return row.identifier;
}
