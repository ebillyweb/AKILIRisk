import { describe, it, expect, beforeEach } from "vitest";
import {
  encrypt,
  decrypt,
  encryptDeterministic,
  decryptDeterministic,
  isCiphertext,
  currentKeyVersion,
  keyForVersion,
} from "./encryption";

/**
 * Round-11 commit 5 (BRD §5.1): tests for the encryption toolkit
 * additions. Existing encrypt/decrypt are sanity-checked too.
 *
 * Test fixture: ENCRYPTION_KEY env var set per-test for determinism +
 * isolation. The key value itself is arbitrary; what matters is that
 * it stays stable for the duration of a test.
 */

const TEST_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

describe("encrypt / decrypt (existing behavior — pinned)", () => {
  it("round-trips a plaintext value", () => {
    const plain = "alice@example.com";
    const cipher = encrypt(plain);
    expect(decrypt(cipher)).toBe(plain);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const plain = "alice@example.com";
    expect(encrypt(plain)).not.toBe(encrypt(plain));
  });

  it("emits the iv:authTag:ciphertext format", () => {
    const cipher = encrypt("hello");
    const parts = cipher.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });
});

describe("encryptDeterministic / decryptDeterministic", () => {
  it("round-trips a plaintext value", () => {
    const plain = "alice@example.com";
    const cipher = encryptDeterministic(plain, "User.email");
    expect(decryptDeterministic(cipher)).toBe(plain);
  });

  it("is deterministic: same plaintext + same fieldKey → same ciphertext", () => {
    const plain = "alice@example.com";
    const a = encryptDeterministic(plain, "User.email");
    const b = encryptDeterministic(plain, "User.email");
    expect(a).toBe(b);
  });

  it("scopes per-column: same plaintext + DIFFERENT fieldKey → DIFFERENT ciphertext", () => {
    const plain = "alice@example.com";
    const userEmail = encryptDeterministic(plain, "User.email");
    const memberEmail = encryptDeterministic(plain, "HouseholdMember.email");
    expect(userEmail).not.toBe(memberEmail);
  });

  it("differs for different plaintexts (collision-resistant)", () => {
    const a = encryptDeterministic("alice@example.com", "User.email");
    const b = encryptDeterministic("bob@example.com", "User.email");
    expect(a).not.toBe(b);
  });

  it("emits the same iv:authTag:ciphertext format as the random-IV path", () => {
    const cipher = encryptDeterministic("hello", "User.email");
    const parts = cipher.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[2]).toMatch(/^[0-9a-f]+$/);
  });

  it("is decryptable via the existing `decrypt` (forward-compat)", () => {
    // The output format is identical, so the existing decrypt path
    // works on deterministic ciphertext without modification. This is
    // the property that lets a read-site mixing plaintext + ciphertext
    // during a rollout use a single decrypt call.
    const plain = "carol@example.com";
    const cipher = encryptDeterministic(plain, "User.email");
    expect(decrypt(cipher)).toBe(plain);
  });
});

describe("isCiphertext", () => {
  it("returns true for ciphertext from encrypt()", () => {
    expect(isCiphertext(encrypt("hello"))).toBe(true);
  });

  it("returns true for ciphertext from encryptDeterministic()", () => {
    expect(isCiphertext(encryptDeterministic("hello", "User.email"))).toBe(true);
  });

  it("returns false for plain alphanumeric values", () => {
    expect(isCiphertext("alice@example.com")).toBe(false);
    expect(isCiphertext("Hello, world")).toBe(false);
    expect(isCiphertext("12345")).toBe(false);
  });

  it("returns false for null / undefined / empty / non-string", () => {
    expect(isCiphertext(null)).toBe(false);
    expect(isCiphertext(undefined)).toBe(false);
    expect(isCiphertext("")).toBe(false);
    // @ts-expect-error testing the runtime guard
    expect(isCiphertext(123)).toBe(false);
  });

  it("returns false when only one or two colons (wrong shape)", () => {
    expect(isCiphertext("just-text")).toBe(false);
    expect(isCiphertext("only:two-parts")).toBe(false);
    expect(isCiphertext("a:b:c:d")).toBe(false);
  });

  it("returns false when IV/authTag aren't 32 hex chars", () => {
    expect(isCiphertext("aa:bb:cc")).toBe(false); // too short
    expect(isCiphertext("z".repeat(32) + ":" + "f".repeat(32) + ":aabb")).toBe(false); // non-hex IV
  });

  it("returns false when ciphertext is empty or has odd hex length", () => {
    const valid = encrypt("hello");
    const parts = valid.split(":");
    expect(isCiphertext(`${parts[0]}:${parts[1]}:`)).toBe(false);
    expect(isCiphertext(`${parts[0]}:${parts[1]}:abc`)).toBe(false); // odd length
  });
});

describe("currentKeyVersion / keyForVersion", () => {
  it("currentKeyVersion returns 1 (v1 stub)", () => {
    expect(currentKeyVersion()).toBe(1);
  });

  it("keyForVersion(1) returns a 32-byte Buffer", () => {
    const key = keyForVersion(1);
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  it("keyForVersion(1) is deterministic for a given ENCRYPTION_KEY", () => {
    const a = keyForVersion(1).toString("hex");
    const b = keyForVersion(1).toString("hex");
    expect(a).toBe(b);
  });

  it("keyForVersion(2+) throws — v1-only build", () => {
    expect(() => keyForVersion(2)).toThrow(/version 2 is not configured/);
    expect(() => keyForVersion(99)).toThrow(/version 99 is not configured/);
  });
});
