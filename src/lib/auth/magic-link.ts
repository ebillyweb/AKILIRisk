import "server-only";

/**
 * Round-11 commit 2 (BRD §5.1.AUTH): magic-link auth helpers for client users.
 *
 * Three pure functions:
 *   - issueMagicLinkToken(email, opts)  — create row, return raw token
 *   - validateMagicLinkToken(rawToken)   — lookup + expiry/used checks
 *   - consumeMagicLinkToken(rawToken)    — flip used=true, set consumedAt
 *
 * All three are designed to be safe under concurrent calls. Validation is
 * non-mutating; consumption is the explicit atomic flip.
 *
 * Token shape: random 32-byte hex (64 chars). Stored hashed via SHA-256
 * so a DB read never exposes a usable token. Mirrors the existing
 * forgot-password flow in src/app/api/auth/forgot-password/route.ts.
 *
 * Default expiry: 15 minutes. Tunable for tests via opts.expiresAt
 * override.
 */

import crypto from "crypto";
import { prisma } from "@/lib/db";
import { findUserByEmail } from "@/lib/auth/user-email";

export const DEFAULT_MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

/** Produce a fresh 32-byte hex token. The raw token is what gets emailed
 *  to the user; only the SHA-256 hash is persisted. */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** SHA-256 hash for storage + lookup. */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export interface IssueMagicLinkTokenOptions {
  /** Optional FK to an InviteCode row when this link is part of an
   *  invitation flow. The verify path uses this to drive User-creation
   *  logic in commit 4. Null/undefined for self-service sign-in by
   *  existing users. */
  inviteCodeId?: string | null;
  /** Override expiry (test-only). Defaults to now + DEFAULT_MAGIC_LINK_TTL_MS. */
  expiresAt?: Date;
}

export interface IssuedMagicLinkToken {
  /** Raw token to embed in the magic-link URL. NOT persisted. */
  rawToken: string;
  /** Persisted row id (for audit + idempotency). */
  tokenId: string;
  /** Expiry timestamp echoed for caller. */
  expires: Date;
}

/**
 * Create a MagicLinkToken row + return the raw token to email to the user.
 *
 * Caller is responsible for the email send + audit row. This function does
 * the DB write only so it can be void-fired off the response timeline (the
 * issuance route mirrors the forgot-password pattern: respond fast, then
 * issue in background).
 */
export async function issueMagicLinkToken(
  email: string,
  opts: IssueMagicLinkTokenOptions = {}
): Promise<IssuedMagicLinkToken> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expires = opts.expiresAt ?? new Date(Date.now() + DEFAULT_MAGIC_LINK_TTL_MS);

  const row = await prisma.magicLinkToken.create({
    data: {
      tokenHash,
      email,
      inviteCodeId: opts.inviteCodeId ?? null,
      expires,
    },
    select: { id: true, expires: true },
  });

  return { rawToken, tokenId: row.id, expires: row.expires };
}

/** Validation result — discriminated on `success` so call sites destructure
 *  the failure reason for audit metadata without reaching into errors. */
export type ValidateMagicLinkResult =
  | {
      success: true;
      tokenId: string;
      email: string;
      inviteCodeId: string | null;
    }
  | {
      success: false;
      reason: "not_found" | "expired" | "used" | "user_inactive";
    };

/**
 * Look up + validate a magic-link token by raw token. Non-mutating: does
 * NOT flip `used`. Caller calls `consumeMagicLinkToken` after sign-in
 * succeeds (so a failed sign-in doesn't waste the token).
 *
 * The `user_inactive` reason is checked here (not in consume) so the auth
 * provider can fail fast on the validation pass without an extra DB
 * round-trip in the consume call.
 */
export async function validateMagicLinkToken(
  rawToken: string
): Promise<ValidateMagicLinkResult> {
  if (!rawToken || typeof rawToken !== "string") {
    return { success: false, reason: "not_found" };
  }
  const tokenHash = hashToken(rawToken);
  const row = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      inviteCodeId: true,
      expires: true,
      used: true,
    },
  });

  if (!row) return { success: false, reason: "not_found" };
  if (row.used) return { success: false, reason: "used" };
  if (row.expires < new Date()) return { success: false, reason: "expired" };

  // user_inactive: the email might match an active InviteCode (creation
  // path) OR an existing active User. Either is fine; if NEITHER is true
  // the token is dead. We look up the User defensively — invitation
  // tokens whose User hasn't been created yet still pass here (caller
  // creates the User on consume).
  if (!row.inviteCodeId) {
    // Round-11 commit 2.3 (BRD §5.1.AUTH / phase A): dual-read shim
    // tries deterministic ciphertext first, falls back to plaintext
    // for rows that haven't been backfilled yet.
    const user = await findUserByEmail(row.email, {
      where: { deletedAt: null },
      select: { id: true },
    });
    if (!user) return { success: false, reason: "user_inactive" };
  }

  return {
    success: true,
    tokenId: row.id,
    email: row.email,
    inviteCodeId: row.inviteCodeId,
  };
}

/**
 * Atomically flip `used=true` + set `consumedAt`. Idempotent under double
 * click: a second call returns `{ success: false, reason: "used" }`
 * because the row already has used=true.
 *
 * Uses `updateMany` with a `where: { used: false }` predicate so two
 * concurrent calls race-safely to the single winning consume — the
 * second call's update touches zero rows and we report "used".
 */
export async function consumeMagicLinkToken(
  rawToken: string
): Promise<{ success: true; email: string; inviteCodeId: string | null } | { success: false; reason: "not_found" | "used" | "expired" }> {
  if (!rawToken) return { success: false, reason: "not_found" };
  const tokenHash = hashToken(rawToken);

  const result = await prisma.magicLinkToken.updateMany({
    where: {
      tokenHash,
      used: false,
      expires: { gt: new Date() },
    },
    data: {
      used: true,
      consumedAt: new Date(),
    },
  });

  if (result.count === 0) {
    // Either not found, already used, or expired — disambiguate via a
    // read.
    const row = await prisma.magicLinkToken.findUnique({
      where: { tokenHash },
      select: { used: true, expires: true },
    });
    if (!row) return { success: false, reason: "not_found" };
    if (row.used) return { success: false, reason: "used" };
    if (row.expires < new Date()) return { success: false, reason: "expired" };
    // Shouldn't happen, but degrade to "not_found" rather than crash.
    return { success: false, reason: "not_found" };
  }

  // Read the now-consumed row to return email + inviteCodeId.
  const consumed = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
    select: { email: true, inviteCodeId: true },
  });
  return {
    success: true,
    email: consumed?.email ?? "",
    inviteCodeId: consumed?.inviteCodeId ?? null,
  };
}

/**
 * Cleanup helper for the issuance route: delete any prior unexpired
 * tokens for this email so a fresh issue invalidates an in-flight one.
 * Mirrors the forgot-password pattern.
 */
export async function invalidatePriorMagicLinkTokens(email: string): Promise<number> {
  const result = await prisma.magicLinkToken.deleteMany({
    where: {
      email,
      expires: { gt: new Date() },
      used: false,
    },
  });
  return result.count;
}
