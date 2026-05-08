/**
 * Option D session 1 commit 1.2 (BRD §5.1 amendment) — round-trip +
 * coexistence tests for the five PII-policy-gated columns.
 *
 * Mirrors the round-11 `response-content.test.ts` shape: pin a
 * deterministic ENCRYPTION_KEY in beforeEach, exercise round-trip,
 * exercise the safe wrappers' three branches (null, plaintext
 * passthrough, ciphertext, tampered ciphertext).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  encryptUserName,
  decryptUserName,
  safeDecryptUserName,
  encryptClientPhone,
  decryptClientPhone,
  safeDecryptClientPhone,
  encryptHouseholdFullName,
  decryptHouseholdFullName,
  safeDecryptHouseholdFullName,
  encryptHouseholdPhone,
  decryptHouseholdPhone,
  safeDecryptHouseholdPhone,
  encryptHouseholdNotes,
  decryptHouseholdNotes,
  safeDecryptHouseholdNotes,
} from "./client-pii";

const TEST_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

// ── 1. Round-trip per field (5 cases) ──────────────────────────────────

describe("round-trip per field", () => {
  it("User.name encrypts then decrypts back to the original value", () => {
    const plain = "Jane Doe";
    expect(decryptUserName(encryptUserName(plain))).toBe(plain);
  });

  it("ClientProfile.phone encrypts then decrypts back", () => {
    const plain = "+1-415-555-0199";
    expect(decryptClientPhone(encryptClientPhone(plain))).toBe(plain);
  });

  it("HouseholdMember.fullName encrypts then decrypts back", () => {
    const plain = "John Q. Public Jr.";
    expect(decryptHouseholdFullName(encryptHouseholdFullName(plain))).toBe(
      plain
    );
  });

  it("HouseholdMember.phone encrypts then decrypts back", () => {
    const plain = "+44 20 7946 0991";
    expect(decryptHouseholdPhone(encryptHouseholdPhone(plain))).toBe(plain);
  });

  it("HouseholdMember.notes encrypts then decrypts back (multi-line)", () => {
    const plain = "Trustee role since 2019.\nLives in same residence.";
    expect(decryptHouseholdNotes(encryptHouseholdNotes(plain))).toBe(plain);
  });
});

// ── 2. Random-IV property — same plaintext yields different ciphertext ──

describe("random-IV property (same plaintext → different ciphertext)", () => {
  it("two encryptions of the same User.name produce different ciphertexts", () => {
    const a = encryptUserName("Jane Doe");
    const b = encryptUserName("Jane Doe");
    expect(a).not.toBe(b);
    // …but they decrypt to the same plaintext.
    expect(decryptUserName(a)).toBe("Jane Doe");
    expect(decryptUserName(b)).toBe("Jane Doe");
  });
});

// ── 3. safeDecrypt* — null / empty passthrough ─────────────────────────

describe("safeDecrypt* handles null + empty input", () => {
  it("safeDecryptUserName returns null on null/undefined/empty", () => {
    expect(safeDecryptUserName(null, { rowId: "x" })).toBeNull();
    expect(safeDecryptUserName(undefined, { rowId: "x" })).toBeNull();
    expect(safeDecryptUserName("", { rowId: "x" })).toBeNull();
  });

  it("each net-new safeDecrypt wrapper handles null too", () => {
    expect(safeDecryptClientPhone(null, { rowId: "x" })).toBeNull();
    expect(safeDecryptHouseholdFullName(null, { rowId: "x" })).toBeNull();
    expect(safeDecryptHouseholdPhone(null, { rowId: "x" })).toBeNull();
    expect(safeDecryptHouseholdNotes(null, { rowId: "x" })).toBeNull();
  });
});

// ── 4. safeDecryptUserName plaintext-passthrough (rollout window) ───────

describe("safeDecryptUserName coexists plaintext + ciphertext", () => {
  it("returns plaintext as-is when the value isn't ciphertext-shaped", () => {
    // The rollout-window case: User.name was plaintext at HEAD; the
    // helper must return it unchanged so a row that hasn't been
    // re-written-as-ciphertext yet still renders correctly.
    expect(safeDecryptUserName("Jane Doe", { rowId: "u1" })).toBe("Jane Doe");
  });

  it("returns the decrypted value when given ciphertext", () => {
    const ct = encryptUserName("Jane Doe");
    expect(safeDecryptUserName(ct, { rowId: "u1" })).toBe("Jane Doe");
  });
});

// ── 5. tamper-resilience — bad ciphertext returns null, doesn't throw ──

describe("safeDecrypt* tamper-resilience", () => {
  it("safeDecryptUserName returns null + warns when ciphertext is corrupted", () => {
    const ct = encryptUserName("Jane Doe");
    // Corrupt the auth-tag segment.
    const parts = ct.split(":");
    const tampered = `${parts[0]}:${"f".repeat(32)}:${parts[2]}`;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeDecryptUserName(tampered, { rowId: "row-1" })).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("safeDecryptHouseholdNotes returns null + warns on a malformed shape", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // 32-char-hex IV + 32-char-hex tag + an even-length hex ciphertext
    // satisfies isCiphertext but fails AES-GCM.
    const fake =
      "00".repeat(16) + ":" + "11".repeat(16) + ":" + "deadbeef";
    expect(safeDecryptHouseholdNotes(fake, { rowId: "hm-1" })).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

// ── 6. Per-field cross-decrypt sanity (no, ciphertext is interchangeable) ──

describe("ciphertext format is shared across helpers", () => {
  // The wrappers all delegate to the same `encrypt`/`decrypt`, so
  // technically a User.name ciphertext could be decrypted by
  // `decryptHouseholdNotes`. We don't enforce per-field domain
  // separation here (the round-11 deterministic helpers do; random-IV
  // helpers don't because there's no equality-leak surface). This test
  // pins the current contract so a future per-field domain separation
  // is a deliberate, documented change.
  it("a User.name ciphertext can be decrypted by decryptHouseholdNotes today", () => {
    const ct = encryptUserName("Jane Doe");
    expect(decryptHouseholdNotes(ct)).toBe("Jane Doe");
  });
});
