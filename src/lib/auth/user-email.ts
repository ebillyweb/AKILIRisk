import "server-only";

import type { Prisma, PrismaClient, User } from "@prisma/client";
import { decryptDeterministic, encryptDeterministic } from "@/lib/encryption";
import { prisma as defaultPrisma } from "@/lib/db";

/**
 * Round-11 commit 2.4a (BRD §5.1.AUTH / phase B — soft-drop step 1) —
 * User.email lookup helpers, post-flip.
 *
 * Phase A (commit 2.3) populated `emailCiphertext` and read both
 * columns ciphertext-first → plaintext-fallback. Phase B step 1
 * (this commit) flipped the unique constraint so `emailCiphertext`
 * is now authoritative; the helpers collapse to a single ciphertext
 * lookup. The plaintext fallback branch is gone — every row is
 * guaranteed to have an emailCiphertext value because the backfill
 * ran AND the column is now NOT NULL.
 *
 * The plaintext `email` column still exists during the 7-day bake
 * window; `userEmailWriteData` keeps writing it so display surfaces
 * (admin lists, settings pages, outbound recipients) can keep
 * reading it without a decrypt round-trip. Phase B step 2 (commit
 * 2.4b) drops the column and switches display surfaces to
 * decrypt-at-read.
 *
 * The deterministic-mode encryption from `src/lib/encryption.ts`
 * yields a stable ciphertext for any given (plaintext, fieldKey)
 * pair, so equality lookups + the UNIQUE constraint both work. The
 * fieldKey "User.email" is reserved for this column — never reuse
 * it elsewhere; that scoping is what prevents an advisor.firmEmail
 * (hypothetical future column) from sharing the same ciphertext as
 * a client's User.email when they happen to be the same plaintext.
 */

/** The deterministic-encryption fieldKey reserved for `User.email`. */
export const USER_EMAIL_FIELD_KEY = "User.email";

/**
 * Compute the deterministic ciphertext for a given plaintext email.
 * Idempotent: same input → same output. Used by all writers, the
 * lookup helper, and the audit-log actor-hash decoder.
 */
export function userEmailCiphertext(email: string): string {
  return encryptDeterministic(email, USER_EMAIL_FIELD_KEY);
}

/**
 * Decrypt a stored emailCiphertext back to plaintext. Inverse of
 * userEmailCiphertext for the same key + fieldKey.
 *
 * Used by:
 *   • NextAuth session callback (puts plaintext into the JWT once
 *     per signin — display surfaces consume `session.user.email`).
 *   • Server-component query mappers for admin/advisor list views.
 *   • Outbound notification + Stripe + reminder paths that need a
 *     real email address.
 *   • The data-export bundle for the BRD §5.3 raw-PII export.
 *   • writeAudit's internal actorEmailHash computation when given a
 *     ciphertext.
 *
 * Throws if the ciphertext is malformed or the key doesn't match —
 * the caller should treat that as an integrity error, not a missing
 * value.
 */
export function decryptUserEmail(ciphertext: string): string {
  return decryptDeterministic(ciphertext);
}

/**
 * Resolve the plaintext email for a User row, preferring the
 * still-populated `email` column for existing rows and decrypting
 * the ciphertext for new rows that didn't get a plaintext write.
 *
 * Display surfaces, outbound notifications, Stripe customer_email,
 * and TOTP issuer labels all transit through this helper so the
 * 2.4a→2.4b bake window is opaque to them — once 2.4b drops the
 * `email` column the helper degrades to "always decrypt" without
 * any call-site change.
 *
 * Why not always decrypt? Pure-decrypt is fine performance-wise
 * (single AES-GCM op ~1µs) but the fallback preserves the option of
 * a phase-A rollback during the bake window — if we revert 2.4a's
 * application code, the existing-rows-with-plaintext branch still
 * works without re-running a backfill.
 */
export function userEmailForDisplay(user: {
  email: string | null;
  emailCiphertext: string;
}): string {
  return user.email ?? decryptUserEmail(user.emailCiphertext);
}

/**
 * Build the `data:` fragment that every User create / update should
 * splat into the Prisma `data:` block.
 *
 *   await prisma.user.update({
 *     where: { id },
 *     data: {
 *       ...userEmailWriteData(newEmail),
 *       firstName: …,
 *     },
 *   });
 *
 * Post-2.4a writes only `emailCiphertext` — the plaintext `email`
 * column is no longer authoritative for auth-path lookups, and
 * display surfaces decrypt at read time, so writing plaintext would
 * just add stale data. Existing rows keep their plaintext (the
 * migration didn't backfill-clear it) for rollback-window safety
 * during the 7-day bake; commit 2.4b drops the column entirely.
 *
 * Call sites are unchanged — they still spread the helper's return
 * into a Prisma `data:` block. The shape of the object shrunk, but
 * `data: { ...userEmailWriteData(email), … }` works the same way.
 */
export function userEmailWriteData(email: string): {
  emailCiphertext: string;
} {
  return {
    emailCiphertext: userEmailCiphertext(email),
  };
}

/**
 * Tx-friendly Prisma surface — both `prisma` and `tx` from
 * `prisma.$transaction(async (tx) => …)` satisfy this. We expose
 * only `findFirst` so callers can't accidentally use update / create
 * through this type.
 */
type PrismaUserReader = {
  user: {
    findFirst: PrismaClient["user"]["findFirst"];
  };
};

/**
 * Optional read filter merged into the WHERE clause. Most callers
 * pass `{ deletedAt: null }` to exclude soft-deleted rows.
 */
type ExtraWhere = Omit<Prisma.UserWhereInput, "email" | "emailCiphertext">;

interface FindUserByEmailOpts {
  /** Extra WHERE filters merged into the lookup. */
  where?: ExtraWhere;
  /** Forward to Prisma `select`. */
  select?: Prisma.UserSelect;
  /** Use a transaction client instead of the default singleton. */
  client?: PrismaUserReader;
}

/**
 * Look up a User by email — single ciphertext-keyed lookup.
 *
 * Post-2.4a the dual-read pattern is gone: `emailCiphertext` is the
 * authoritative auth-path column, every row is guaranteed to have a
 * non-null value (NOT NULL constraint), and the deterministic
 * ciphertext for a given plaintext + fieldKey is stable, so a single
 * findFirst against the new UNIQUE index gets us there.
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

  return client.user.findFirst({
    where: { ...baseWhere, emailCiphertext: ciphertext } as Prisma.UserWhereInput,
    ...(opts.select ? { select: opts.select } : {}),
  } as Parameters<PrismaClient["user"]["findFirst"]>[0]);
}
