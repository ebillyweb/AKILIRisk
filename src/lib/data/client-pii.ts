/**
 * Option D session 1 commit 1.2 (BRD §5.1 amendment) — encryption
 * helpers for the five eligible PII fields gated by an advisor's
 * `AdvisorProfile.piiPolicy`.
 *
 * Eligible columns:
 *
 *   • User.name                       (existed plaintext at HEAD; sniff-and-passthrough at read)
 *   • ClientProfile.phone             (re-added in commit 1.1; net-new column)
 *   • HouseholdMember.fullName        (re-added in commit 1.1; net-new column)
 *   • HouseholdMember.phone           (re-added in commit 1.1; net-new column)
 *   • HouseholdMember.notes           (re-added in commit 1.1; net-new column)
 *
 * All five use random-IV AES-256-GCM via the existing `encrypt`/`decrypt`
 * helpers in `@/lib/encryption`. Random-IV is correct here because:
 *
 *   • None of these columns are queried by content in production (no
 *     unique constraints, no equality lookups, no full-text search).
 *   • Random-IV ciphertext leaks nothing about content equality
 *     ("client A and client B share a phone number" → not visible to
 *     anyone with read-only DB access).
 *
 * Per-field thin wrappers (instead of a single `encryptOptionalText`)
 * are deliberate: every call site is greppable by field name, mirroring
 * the round-11 `response-content.ts` pattern (encryptTranscription /
 * encryptAnswer). Future per-field policy nuances (e.g. one field
 * gaining a deterministic mode) can land without churning every call
 * site.
 *
 * Rollout coexistence — User.name only:
 *
 *   `safeDecryptUserName` sniffs `isCiphertext()` and falls through to
 *   plaintext during the writes-over-time rollout window. The other
 *   four columns are net-new from commit 1.1 (no pre-existing
 *   plaintext data), but their `safeDecrypt*` wrappers do the same
 *   sniff as a no-op safety net so future bulk-restore tooling
 *   doesn't surface accidentally-plaintext rows as opaque errors.
 *
 * No `server-only` import — this module is reachable from CLI scripts
 * (e.g. a future force-rotate backfill that re-encrypts plaintext
 * `User.name` in bulk).
 */
import { decrypt, encrypt, isCiphertext } from "@/lib/encryption";

// ── User.name ─────────────────────────────────────────────────────────

/** Encrypt a `User.name` plaintext. Empty string is encrypted as-is —
 *  the caller stores NULL when the field is genuinely cleared. */
export function encryptUserName(plaintext: string): string {
  return encrypt(plaintext);
}

/** Decrypt a `User.name` ciphertext. Throws on tampered ciphertext or
 *  malformed input. Use `safeDecryptUserName` at sites where a single
 *  bad row should not cascade into a 500. */
export function decryptUserName(ciphertext: string): string {
  return decrypt(ciphertext);
}

/** Tamper-resilient + plaintext-tolerant `User.name` decrypt. Returns
 *  null on null/empty input, the plaintext value when the column hasn't
 *  yet been written-over with ciphertext (rollout window), the
 *  decrypted value when it has, and null + a structured warn on
 *  decrypt failure. */
export function safeDecryptUserName(
  value: string | null | undefined,
  context: { rowId: string }
): string | null {
  if (value == null || value === "") return null;
  if (!isCiphertext(value)) return value; // pre-encryption rollout
  try {
    return decryptUserName(value);
  } catch {
    console.warn(
      `[client-pii] decrypt failed — User.name rowId=${context.rowId}`
    );
    return null;
  }
}

// ── ClientProfile.phone ───────────────────────────────────────────────

export function encryptClientPhone(plaintext: string): string {
  return encrypt(plaintext);
}

export function decryptClientPhone(ciphertext: string): string {
  return decrypt(ciphertext);
}

/** Net-new column from commit 1.1; `isCiphertext` sniff is a no-op
 *  safety net (no plaintext rows exist yet but bulk-restore tooling
 *  could in principle surface them). */
export function safeDecryptClientPhone(
  value: string | null | undefined,
  context: { rowId: string }
): string | null {
  if (value == null || value === "") return null;
  if (!isCiphertext(value)) return value;
  try {
    return decryptClientPhone(value);
  } catch {
    console.warn(
      `[client-pii] decrypt failed — ClientProfile.phone rowId=${context.rowId}`
    );
    return null;
  }
}

// ── HouseholdMember.fullName ──────────────────────────────────────────

export function encryptHouseholdFullName(plaintext: string): string {
  return encrypt(plaintext);
}

export function decryptHouseholdFullName(ciphertext: string): string {
  return decrypt(ciphertext);
}

export function safeDecryptHouseholdFullName(
  value: string | null | undefined,
  context: { rowId: string }
): string | null {
  if (value == null || value === "") return null;
  if (!isCiphertext(value)) return value;
  try {
    return decryptHouseholdFullName(value);
  } catch {
    console.warn(
      `[client-pii] decrypt failed — HouseholdMember.fullName rowId=${context.rowId}`
    );
    return null;
  }
}

// ── HouseholdMember.phone ─────────────────────────────────────────────

export function encryptHouseholdPhone(plaintext: string): string {
  return encrypt(plaintext);
}

export function decryptHouseholdPhone(ciphertext: string): string {
  return decrypt(ciphertext);
}

export function safeDecryptHouseholdPhone(
  value: string | null | undefined,
  context: { rowId: string }
): string | null {
  if (value == null || value === "") return null;
  if (!isCiphertext(value)) return value;
  try {
    return decryptHouseholdPhone(value);
  } catch {
    console.warn(
      `[client-pii] decrypt failed — HouseholdMember.phone rowId=${context.rowId}`
    );
    return null;
  }
}

// ── HouseholdMember.notes ─────────────────────────────────────────────

export function encryptHouseholdNotes(plaintext: string): string {
  return encrypt(plaintext);
}

export function decryptHouseholdNotes(ciphertext: string): string {
  return decrypt(ciphertext);
}

export function safeDecryptHouseholdNotes(
  value: string | null | undefined,
  context: { rowId: string }
): string | null {
  if (value == null || value === "") return null;
  if (!isCiphertext(value)) return value;
  try {
    return decryptHouseholdNotes(value);
  } catch {
    console.warn(
      `[client-pii] decrypt failed — HouseholdMember.notes rowId=${context.rowId}`
    );
    return null;
  }
}
