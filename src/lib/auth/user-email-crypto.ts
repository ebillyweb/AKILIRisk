/**
 * Deterministic encryption for `User.email` — safe for CLI scripts and tests.
 *
 * `user-email.ts` wraps this with `import "server-only"` for app code. Do not
 * add `server-only` here: `npx tsx scripts/…` must be able to import this file.
 */
import { decryptDeterministic, encryptDeterministic } from "@/lib/encryption";

/** The deterministic-encryption fieldKey reserved for `User.email`. */
export const USER_EMAIL_FIELD_KEY = "User.email";

/** Compute deterministic ciphertext for a plaintext email (stable per key). */
export function userEmailCiphertext(email: string): string {
  return encryptDeterministic(email, USER_EMAIL_FIELD_KEY);
}

/** Decrypt a stored `emailCiphertext` value back to plaintext. */
export function decryptUserEmail(ciphertext: string): string {
  return decryptDeterministic(ciphertext);
}
