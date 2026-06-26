/**
 * Deterministic encryption for `User.email` — safe for CLI scripts and tests.
 *
 * `user-email.ts` wraps this with `import "server-only"` for app code. Do not
 * add `server-only` here: `npx tsx scripts/…` must be able to import this file.
 */
import {
  decryptDeterministic,
  encryptDeterministic,
  isCiphertext,
} from "@/lib/encryption";

/** The deterministic-encryption fieldKey reserved for `User.email`. */
export const USER_EMAIL_FIELD_KEY = "User.email";

/**
 * Normalize an email before it's used as input to deterministic
 * encryption (or to any equality-comparison key derived from it).
 *
 * Without this, `Alice@Example.com` and `alice@example.com` would
 * encrypt to different ciphertexts under the deterministic-mode IV
 * derivation (HMAC-SHA256("User.email", plaintext) → 16 bytes), so:
 *
 *   • The `User.emailCiphertext @unique` constraint wouldn't catch a
 *     case-different signup as a duplicate, allowing two parallel
 *     accounts for the "same" email.
 *   • A user who signed up with `Alice@…` but later types
 *     `alice@…` at signin would get a `findFirst` miss and land on
 *     the user-not-found branch (locked out of their own account).
 *
 * Email is case-insensitive in the domain part by RFC and effectively
 * case-insensitive in the local part on every common provider, so
 * lowercase + trim is the standard normalization. This must be
 * applied at EVERY ciphertext write and EVERY ciphertext lookup —
 * the helpers in `user-email.ts` route through this function so
 * call sites get it for free.
 */
export function normalizeEmailForCiphertext(email: string): string {
  return email.trim().toLowerCase();
}

/** Compute deterministic ciphertext for a plaintext email (stable per
 *  key). The input is normalized via `normalizeEmailForCiphertext` so
 *  two case-different inputs for the "same" email collapse to one
 *  ciphertext. */
export function userEmailCiphertext(email: string): string {
  return encryptDeterministic(
    normalizeEmailForCiphertext(email),
    USER_EMAIL_FIELD_KEY
  );
}

/** Decrypt a stored `emailCiphertext` value back to plaintext.
 *  Returns whatever bytes were originally encrypted — i.e. the
 *  normalized lowercase form for rows written by the post-fix
 *  helper, or the original-case form for any pre-fix row that
 *  hasn't been re-encrypted yet. */
export function decryptUserEmail(ciphertext: string): string {
  return decryptDeterministic(ciphertext);
}

/** Tamper-resilient decrypt for list/report surfaces. Returns null + warns
 *  when ciphertext was encrypted with a different ENCRYPTION_KEY. */
export function safeDecryptUserEmail(
  value: string | null | undefined,
  context: { rowId: string }
): string | null {
  if (value == null || value === "") return null;
  if (!isCiphertext(value)) return value;
  try {
    return decryptUserEmail(value);
  } catch {
    console.warn(
      `[user-email] decrypt failed — User.email rowId=${context.rowId}`
    );
    return null;
  }
}
