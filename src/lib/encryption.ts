import crypto from "crypto";

// ── Round-11 commit 5 (BRD §5.1) — toolkit additions ────────────────────
//
// Extends the existing AES-256-GCM helper (used today for User.mfaSecret)
// with three new pieces:
//
//   1. encryptDeterministic / decryptDeterministic — IV is derived via
//      HMAC-SHA256(fieldKey, plaintext) instead of crypto.randomBytes.
//      Same plaintext + same fieldKey → same ciphertext, so unique
//      constraints + equality lookups still work after a column flips
//      to ciphertext storage. Used for User.email lookup in the future
//      column-encryption rollout (round-11 / round-12 follow-up
//      commits).
//
//   2. isCiphertext — sniffs the iv:authTag:ciphertext shape so a
//      column being migrated transparently falls through to plaintext
//      during the rollout window. Read site does:
//          const value = isCiphertext(row.x) ? decrypt(row.x) : row.x;
//
//   3. currentKeyVersion / keyForVersion — placeholder structures for
//      a future key-rotation strategy. v1 returns version=1 + the
//      same key as today. The intended v2 path (deferred) is to
//      thread a `version` column on each encrypted row + dual-decrypt
//      during rotation windows; the API stays stable.
//
// Existing encrypt/decrypt are preserved verbatim. The deterministic
// pair shares the same iv:authTag:ciphertext output format so a future
// `decrypt` upgrade that auto-detects mode is feasible without
// changing storage shape.

// ── scrypt key-derivation memoization ──────────────────────────────────
//
// scrypt with default cost is ~50ms per call. Pre-perf-fix the encrypt /
// decrypt / encryptDeterministic / decryptDeterministic helpers each
// re-derived the key on every invocation, so a 100-row scoring batch
// burned ~5 seconds of CPU on KDF alone — orders of magnitude more
// than the AES-GCM work.
//
// The derived key is a pure function of the ENCRYPTION_KEY env value
// (and the fixed salt), so we cache it per-env-value in a Map. Production
// reads the same ENCRYPTION_KEY for the lifetime of the process →
// O(1) lookups after the first call. Tests that mutate ENCRYPTION_KEY
// in `beforeEach` still derive correctly: each distinct key string is
// cached separately, so a key change forces a fresh scryptSync.
//
// Memory cost: 32 bytes per unique key string. Bounded by the number of
// distinct keys the process ever sees — production: 1, tests: a handful.
const derivedKeyCache = new Map<string, Buffer>();

/** Internal: derive (and cache) the 32-byte AES key from
 *  ENCRYPTION_KEY. Pulled out so encrypt / decrypt / encryptDeterministic
 *  / decryptDeterministic share one cached derivation. The "salt" is
 *  intentionally fixed — KDF salt collision isn't a concern because
 *  ENCRYPTION_KEY is the entropy source and scrypt is being used to
 *  stretch a configured passphrase, not to hash distinct inputs. */
function deriveAesKey(): Buffer {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  let cached = derivedKeyCache.get(encryptionKey);
  if (!cached) {
    cached = crypto.scryptSync(encryptionKey, "salt", 32);
    derivedKeyCache.set(encryptionKey, cached);
  }
  return cached;
}

/**
 * AES-256-GCM encryption for sensitive data (e.g., MFA secrets)
 * Returns format: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  // Memoized scrypt — see deriveAesKey() above.
  const key = deriveAesKey();

  // Generate random IV (16 bytes for AES)
  const iv = crypto.randomBytes(16);

  // Create cipher with AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  // Encrypt plaintext
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Return concatenated: iv:authTag:ciphertext
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
}

/**
 * Decrypt AES-256-GCM encrypted data
 * Expects format: iv:authTag:ciphertext (all hex encoded)
 */
export function decrypt(encrypted: string): string {
  // Memoized scrypt — see deriveAesKey() above.
  const key = deriveAesKey();

  // Split the encrypted string
  const parts = encrypted.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const ciphertext = parts[2];

  // Create decipher
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let plaintext = decipher.update(ciphertext, "hex", "utf8");
  plaintext += decipher.final("utf8");

  return plaintext;
}

// ── Round-11 commit 5: deterministic mode + key-version helpers ─────────
// (deriveAesKey lives above — both modes share the same memoization.)

/**
 * Deterministic AES-256-GCM encryption.
 *
 * IV is derived via HMAC-SHA256(fieldKey, plaintext) truncated to 16 bytes
 * instead of crypto.randomBytes(16). This makes encryption deterministic:
 * the same plaintext encrypted with the same `fieldKey` always produces
 * the same ciphertext. That preserves unique-constraint behavior on the
 * database column and lets equality-lookup queries (e.g. User.findUnique
 * by email) still work after the column flips from plaintext to ciphertext.
 *
 * The `fieldKey` argument scopes the determinism per-column — two columns
 * containing the same email value get different ciphertexts, so a leaked
 * email-column ciphertext can't be cross-referenced against another
 * column's row. Conventional fieldKey values: "User.email", "User.name",
 * etc. — match the column path so they're greppable in code review.
 *
 * Output format matches the existing `encrypt` function (iv:authTag:
 * ciphertext, hex), so `decrypt` can decrypt deterministic ciphertext
 * without modification. We export `decryptDeterministic` for symmetry +
 * call-site clarity.
 *
 * Caveat — same plaintext + same fieldKey = same ciphertext, so an
 * attacker with read access to the ciphertext column can see equality
 * patterns ("these two rows have the same email"). This is the inherent
 * tradeoff of deterministic encryption; use random-IV encryption for
 * any column where equality-leak is unacceptable.
 */
export function encryptDeterministic(plaintext: string, fieldKey: string): string {
  const key = deriveAesKey();

  // HMAC-SHA256(fieldKey, plaintext) → 32 bytes; take first 16 for IV.
  // The fieldKey is the HMAC secret so two columns with the same plaintext
  // yield different IVs (and therefore different ciphertexts).
  const iv = crypto
    .createHmac("sha256", fieldKey)
    .update(plaintext, "utf8")
    .digest()
    .subarray(0, 16);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
}

/**
 * Decrypt deterministic ciphertext.
 *
 * Identical to `decrypt` because the on-disk format is the same — the
 * IV in the ciphertext string is what the decipher consumes regardless
 * of how that IV was generated. Exposed as a separate export so call
 * sites that decrypt deterministically-encrypted columns are
 * self-documenting.
 */
export function decryptDeterministic(ciphertext: string): string {
  return decrypt(ciphertext);
}

/**
 * Sniff the iv:authTag:ciphertext shape used by both encrypt and
 * encryptDeterministic. Returns true if the value structurally looks
 * like ciphertext, false for plaintext (or anything malformed).
 *
 * Used during column-encryption rollouts: the read site does
 *     const v = isCiphertext(row.x) ? decrypt(row.x) : row.x;
 * so a partially-backfilled column transparently mixes plaintext +
 * ciphertext rows during the migration window.
 *
 * The check is conservative: we don't try to actually decrypt — that
 * would catch any "ciphertext that uses a different key" case but is
 * orders of magnitude more expensive. Format-only check is fine
 * because plaintext that happens to match the iv:authTag:ciphertext
 * shape (32 hex chars : 32 hex chars : even-length hex) is
 * astronomically unlikely in real-world data.
 */
export function isCiphertext(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  // IV is 16 bytes → 32 hex chars; authTag is 16 bytes → 32 hex chars;
  // ciphertext is variable length but always hex (even number of chars).
  if (parts[0].length !== 32) return false;
  if (parts[1].length !== 32) return false;
  if (parts[2].length === 0 || parts[2].length % 2 !== 0) return false;
  const hexRe = /^[0-9a-f]+$/i;
  return hexRe.test(parts[0]) && hexRe.test(parts[1]) && hexRe.test(parts[2]);
}

/**
 * Current encryption-key version. v1 (this commit) returns 1; the
 * keyForVersion helper returns the same key regardless of version.
 *
 * The intended v2 (deferred to a future commit) is to:
 *   1. Add an `encryption_key_version` Int column to each encrypted row.
 *   2. Set ENCRYPTION_KEY_PRIMARY (new) + ENCRYPTION_KEY_LEGACY (old)
 *      env vars during rotation windows.
 *   3. encrypt() writes with the primary version; decrypt() reads the
 *      version from the row, fetches that key via keyForVersion, and
 *      decrypts with it.
 *   4. A background job re-encrypts legacy-version rows at primary
 *      version; once 100% rolled, the legacy key + version-fork is
 *      removed.
 *
 * The API surface (currentKeyVersion + keyForVersion) is stable across
 * v1 → v2 so no read/write site needs changes when the rotation infra
 * lands. v1 is a stub that future-proofs the call sites.
 */
export function currentKeyVersion(): number {
  return 1;
}

export function keyForVersion(version: number): Buffer {
  if (version !== 1) {
    throw new Error(
      `Encryption key version ${version} is not configured. Only v1 is supported in this build.`
    );
  }
  return deriveAesKey();
}
