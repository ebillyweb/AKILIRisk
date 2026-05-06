import "server-only";

import type { Prisma, PrismaClient, User } from "@prisma/client";
import { encryptDeterministic } from "@/lib/encryption";
import { prisma as defaultPrisma } from "@/lib/db";

/**
 * Round-11 commit 2.3 (BRD §5.1.AUTH / phase A) — User.email dual-mode shim.
 *
 * Phase A is additive only: the User table now carries both `email`
 * (plaintext, still unique) and `emailCiphertext` (deterministic AES,
 * nullable + non-unique). Application code uses these helpers so that
 * during the migration window:
 *
 *   • READS find a user whether or not the row has been backfilled —
 *     ciphertext-first lookup, falling back to plaintext.
 *   • WRITES populate both columns on every create / update so the
 *     phase-B flip (drop UNIQUE on `email`, add UNIQUE on
 *     `emailCiphertext`, NOT NULL on `emailCiphertext`) is a pure
 *     constraint move with no data migration step.
 *
 * The deterministic-mode encryption from `src/lib/encryption.ts`
 * yields a stable ciphertext for any given (plaintext, fieldKey)
 * pair, so equality lookups and the upcoming UNIQUE constraint both
 * work. The fieldKey "User.email" is reserved for this column —
 * never reuse it elsewhere; that scoping is what prevents an
 * advisor.firmEmail (hypothetical future column) from sharing the
 * same ciphertext as a client's User.email when they happen to be
 * the same plaintext.
 */

/** The deterministic-encryption fieldKey reserved for `User.email`. */
export const USER_EMAIL_FIELD_KEY = "User.email";

/**
 * Compute the deterministic ciphertext for a given plaintext email.
 * Idempotent: same input → same output. Used by all writers + the
 * dual-read fallback path.
 */
export function userEmailCiphertext(email: string): string {
  return encryptDeterministic(email, USER_EMAIL_FIELD_KEY);
}

/**
 * Build the `data:` fragment that every User create / update should
 * splat in alongside its other field assignments. Wraps both columns
 * so call sites can't accidentally write only one.
 *
 *   await prisma.user.update({
 *     where: { id },
 *     data: {
 *       ...userEmailWriteData(newEmail),
 *       firstName: …,
 *     },
 *   });
 *
 * Returning a typed Prisma fragment (rather than a free-form Record)
 * keeps the call site type-safe; the `as never` escape hatch is
 * used internally only because the locally-generated Prisma client
 * may pre-date the migration during the rollout window.
 */
export function userEmailWriteData(email: string): {
  email: string;
  emailCiphertext: string;
} {
  return {
    email,
    emailCiphertext: userEmailCiphertext(email),
  };
}

/**
 * Tx-friendly Prisma surface — both `prisma` and `tx` from
 * `prisma.$transaction(async (tx) => …)` satisfy this. The findFirst
 * surface is the one we actually need; we don't widen to `User` on
 * purpose so callers can't accidentally use update / create through
 * this type.
 */
type PrismaUserReader = {
  user: {
    findFirst: PrismaClient["user"]["findFirst"];
  };
};

/**
 * Optional read filter to be merged into the WHERE clause for both
 * the ciphertext-keyed and plaintext-keyed lookups. Most callers
 * pass `{ deletedAt: null }` to exclude soft-deleted rows.
 */
type ExtraWhere = Omit<Prisma.UserWhereInput, "email" | "emailCiphertext">;

interface FindUserByEmailOpts {
  /** Extra WHERE filters merged into both lookups. */
  where?: ExtraWhere;
  /** Forward to Prisma `select`. */
  select?: Prisma.UserSelect;
  /** Use a transaction client instead of the default singleton. */
  client?: PrismaUserReader;
}

/**
 * Look up a User by email, transparently handling the ciphertext +
 * plaintext dual state during the rollout window.
 *
 * Algorithm:
 *   1. Compute the deterministic ciphertext.
 *   2. findFirst by `emailCiphertext` (fast path — index hit).
 *   3. If miss, findFirst by `email` (slow path for un-backfilled rows).
 *
 * The ciphertext-first ordering is intentional: once the backfill
 * lands every row matches in step 2 and step 3 is unreachable, so we
 * pay one query per lookup in steady state. Pre-backfill we pay two
 * queries for un-backfilled rows, which is acceptable for the
 * migration window.
 *
 * Returns whatever Prisma returns for findFirst — the `select` shape
 * if provided, otherwise the full User row, or null if not found.
 */
export async function findUserByEmail<S extends Prisma.UserSelect>(
  email: string,
  opts: FindUserByEmailOpts & { select: S }
): Promise<Prisma.UserGetPayload<{ select: S }> | null>;
export async function findUserByEmail(
  email: string,
  opts?: FindUserByEmailOpts
): Promise<User | null>;
export async function findUserByEmail(
  email: string,
  opts: FindUserByEmailOpts = {}
): Promise<unknown> {
  const client = opts.client ?? defaultPrisma;
  const ciphertext = userEmailCiphertext(email);
  const baseWhere: Prisma.UserWhereInput = opts.where ?? {};

  const ctRow = await client.user.findFirst({
    where: { ...baseWhere, emailCiphertext: ciphertext } as Prisma.UserWhereInput,
    ...(opts.select ? { select: opts.select } : {}),
  } as Parameters<PrismaClient["user"]["findFirst"]>[0]);
  if (ctRow) return ctRow;

  return client.user.findFirst({
    where: { ...baseWhere, email } as Prisma.UserWhereInput,
    ...(opts.select ? { select: opts.select } : {}),
  } as Parameters<PrismaClient["user"]["findFirst"]>[0]);
}
