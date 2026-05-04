import { createHash } from "crypto";

/**
 * Redact PII and secret-shaped values from a payload before writing it to the
 * audit log. Applied to every `beforeData`, `afterData`, and `metadata` object
 * passed to `writeAudit`.
 *
 * Rules (fail-closed: if in doubt, redact):
 *   1. Strip values whose KEY matches /secret|token|password|recoveryCodes/i.
 *      Replaced with the literal string "[REDACTED]".
 *   2. Hash values whose KEY ends in `email` (case-insensitive). Replaces
 *      with `{ emailHash: "<8-char sha256 prefix>" }`. Hash matches the
 *      pattern in src/lib/auth.config.ts:emailHash() and src/lib/auth.ts so
 *      a single email correlates across log lines and audit rows.
 *   3. Truncate string values over 500 chars. Stops voice-transcript blobs,
 *      stack traces, etc. from bloating audit rows.
 *   4. Recurse into objects and arrays; everything else passes through.
 *
 * NOT covered here (caller responsibility):
 *   - HouseholdMember names, ages, occupations, phones — BRD §5.1 explicitly
 *     excludes household-member PII. Callers wiring household-member actions
 *     must pre-scrub the payload before calling writeAudit. (We can't tell
 *     "name on User" from "name on HouseholdMember" by key shape alone, and
 *     User.name is useful for admin audit reading.)
 */
export function redactForAudit<T = unknown>(value: T): T {
  return redactInner(value) as T;
}

function redactInner(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(redactInner);
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(key)) {
        out[key] = "[REDACTED]";
        continue;
      }
      if (isEmailKey(key)) {
        if (typeof val === "string" && val.length > 0) {
          out[key] = { emailHash: shortEmailHash(val) };
        } else if (val === null || val === undefined) {
          out[key] = val;
        } else {
          // Non-string in an email field — defensive: redact rather than pass through.
          out[key] = "[REDACTED]";
        }
        continue;
      }
      out[key] = redactInner(val);
    }
    return out;
  }

  if (typeof value === "string" && value.length > 500) {
    return value.slice(0, 500) + "…[truncated]";
  }

  return value;
}

function isSecretKey(key: string): boolean {
  return /secret|token|password|recoveryCodes/i.test(key);
}

function isEmailKey(key: string): boolean {
  // Match `email`, `userEmail`, `clientEmail`, `recipientEmail`, `advisorEmail`,
  // `prefillEmail`, `supportEmail`, etc. — anything ending in "email" case-insensitive.
  return /email$/i.test(key);
}

/**
 * 8-char sha256 prefix of a lowercase email. Matches the helper in
 * src/lib/auth.config.ts and src/lib/auth.ts so the same email produces the
 * same hash everywhere it's logged. Collision-tolerant for grouping; not a
 * join key.
 */
export function shortEmailHash(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 8);
}
