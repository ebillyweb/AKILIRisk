import "server-only";

import type { Prisma, PrismaClient, User } from "@prisma/client";
import { encryptDeterministic } from "@/lib/encryption";
import { prisma as defaultPrisma } from "@/lib/db";
import {
  decryptUserEmail,
  USER_EMAIL_FIELD_KEY,
  userEmailCiphertext,
} from "@/lib/auth/user-email-crypto";

export {
  USER_EMAIL_FIELD_KEY,
  decryptUserEmail,
  safeDecryptUserEmail,
  userEmailCiphertext,
} from "@/lib/auth/user-email-crypto";

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

/**
 * Resolve the plaintext email for a User row.
 *
 * Round-11 commit 2.4b (BRD §5.1.AUTH / phase B — soft-drop step 2):
 * the plaintext `email` column was dropped; this helper now always
 * decrypts. The signature still accepts an optional `email` field
 * for forward-compat with old call sites — if a call site somehow
 * passes plaintext, we use it (won't happen in production but
 * simplifies test fixtures).
 *
 * Display surfaces, outbound notifications, Stripe customer_email,
 * and TOTP issuer labels all transit through this helper. AES-GCM
 * decrypt is ~1µs per op, so even a 1000-row admin list view costs
 * <5ms total decrypt time — acceptable for any list size we ship.
 */
export function userEmailForDisplay(user: {
  email?: string | null;
  emailCiphertext: string;
}): string {
  return user.email ?? decryptUserEmail(user.emailCiphertext);
}

/**
 * Query-layer mapper: take a User-like row that has `emailCiphertext`
 * and return the same shape with a plaintext `email` field added.
 * The intent is to keep the contract stable for existing consumers
 * (server components, page renderers) so they can keep reading
 * `.email` without knowing about encryption.
 *
 *   const users = await prisma.user.findMany({
 *     select: { id: true, name: true, emailCiphertext: true, … },
 *   });
 *   return users.map(withDecryptedEmail);
 *
 * For nested relations (e.g. `intakeInterview.user.emailCiphertext`),
 * use the relation-shaped variants in the call-site query module —
 * this top-level helper covers the flat case only.
 */
export function withDecryptedEmail<T extends { emailCiphertext: string }>(
  user: T
): T & { email: string } {
  return { ...user, email: decryptUserEmail(user.emailCiphertext) };
}

/**
 * Same as `withDecryptedEmail` but for rows where the email lives
 * under a `user.` relation: `{ user: { emailCiphertext, … } }` →
 * `{ user: { emailCiphertext, …, email } }`. Common shape for
 * intakeInterview / assessment / advisorProfile / etc. queries
 * that join the User table.
 */
export function withDecryptedRelationEmail<
  T extends { user: { emailCiphertext: string } | null }
>(row: T): T extends { user: infer U }
  ? Omit<T, "user"> & { user: (U & { email: string }) | null }
  : never {
  if (!row.user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { ...row, user: null } as any;
  }
   
  return {
    ...row,
    user: { ...row.user, email: decryptUserEmail(row.user.emailCiphertext) },
  } as any;
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
 * Look up a User by email — ciphertext-keyed lookup.
 *
 * Post-2.4a the dual-read pattern is gone: `emailCiphertext` is the
 * authoritative auth-path column, every row is guaranteed to have a
 * non-null value (NOT NULL constraint), and the deterministic
 * ciphertext for a given plaintext + fieldKey is stable, so a
 * findFirst against the new UNIQUE index gets us there.
 *
 * Returns whatever Prisma returns for findFirst — the `select` shape
 * if provided, otherwise the full User row, or null if not found.
 *
 * Round-11 bug-hunt fix (RISK 1, email case-normalization): the
 * canonical lookup key is the lowercased ciphertext. During the
 * migration window — between the helper's case-normalization
 * landing and `scripts/normalize-user-email-ciphertext.ts` running
 * against the DB — some rows still have ciphertext computed against
 * the original (mixed-case) plaintext. We fall back to the
 * un-normalized ciphertext when the normalized lookup misses, so
 * case-mixed legacy rows still authenticate. After the backfill
 * completes the fallback branch can be removed; the cost is one
 * extra equality lookup on the unique index per signin attempt
 * that misses.
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
  const baseWhere: Prisma.UserWhereInput = opts.where ?? {};
  const select = opts.select ? { select: opts.select } : {};

  // Primary path: normalized (lowercased + trimmed) ciphertext.
  const normalizedCiphertext = userEmailCiphertext(email);
  const primary = await client.user.findFirst({
    where: {
      ...baseWhere,
      emailCiphertext: normalizedCiphertext,
    } as Prisma.UserWhereInput,
    ...select,
  } as Parameters<PrismaClient["user"]["findFirst"]>[0]);
  if (primary) return primary;

  // Migration-window fallback: if the input was non-lowercase, look up
  // the ciphertext for the original-case plaintext too. Pre-fix rows
  // that stored ciphertext for mixed-case plaintext are still findable.
  // Skip the second query when the input is already in normalized form
  // (no distinct ciphertext to try) — saves a roundtrip on every miss.
  if (email !== email.trim().toLowerCase()) {
    const rawCiphertext = encryptDeterministic(email, USER_EMAIL_FIELD_KEY);
    if (rawCiphertext !== normalizedCiphertext) {
      return client.user.findFirst({
        where: {
          ...baseWhere,
          emailCiphertext: rawCiphertext,
        } as Prisma.UserWhereInput,
        ...select,
      } as Parameters<PrismaClient["user"]["findFirst"]>[0]);
    }
  }
  return null;
}
