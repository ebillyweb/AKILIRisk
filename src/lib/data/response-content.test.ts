/**
 * Round-11 commit 2.5a (BRD §5.1) — encryption-helper round-trip tests
 * for IntakeResponse.transcription and AssessmentResponse.answer.
 *
 * Pin a deterministic ENCRYPTION_KEY in beforeEach so each test gets
 * the same scrypt-derived AES key. The key value itself doesn't
 * matter for correctness — only that it stays stable for the
 * duration of a single test.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  encryptTranscription,
  decryptTranscription,
  encryptAnswer,
  decryptAnswer,
  safeDecryptAnswer,
  safeDecryptTranscription,
} from "./response-content";

const TEST_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

describe("encryptTranscription / decryptTranscription", () => {
  it("round-trips a short single-line plaintext", () => {
    const plain = "We meet quarterly with our advisor.";
    expect(decryptTranscription(encryptTranscription(plain))).toBe(plain);
  });

  it("round-trips a long multi-paragraph plaintext", () => {
    const plain =
      "Paragraph one with several sentences. The decision-making process is documented in our family charter.\n\n" +
      "Paragraph two follows with additional context. Successors are identified but not yet formally named in the trust documents.\n\n" +
      "Paragraph three: some details about advisor relationships, including our wealth manager, attorney, and accountant.";
    expect(decryptTranscription(encryptTranscription(plain))).toBe(plain);
  });

  it("round-trips an empty string", () => {
    expect(decryptTranscription(encryptTranscription(""))).toBe("");
  });

  it("round-trips unicode (emoji + diacritics + multi-byte chars)", () => {
    const plain = "Café — résumé — naïve — 日本語 — 🔐 secured";
    expect(decryptTranscription(encryptTranscription(plain))).toBe(plain);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    const plain = "stable input";
    expect(encryptTranscription(plain)).not.toBe(encryptTranscription(plain));
  });

  it("emits the iv:authTag:ciphertext shape", () => {
    const ct = encryptTranscription("hello");
    const parts = ct.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/); // 16-byte IV
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/); // 16-byte auth tag
    expect(parts[2]).toMatch(/^[0-9a-f]+$/); // hex ciphertext
  });

  it("throws on tampered ciphertext (AES-GCM auth failure)", () => {
    const ct = encryptTranscription("integrity-test");
    // Flip a single hex char in the ciphertext segment.
    const parts = ct.split(":");
    const bytes = parts[2].split("");
    bytes[0] = bytes[0] === "a" ? "b" : "a";
    const tampered = `${parts[0]}:${parts[1]}:${bytes.join("")}`;
    expect(() => decryptTranscription(tampered)).toThrow();
  });
});

describe("encryptAnswer / decryptAnswer", () => {
  it("round-trips a numeric answer", () => {
    expect(decryptAnswer<number>(encryptAnswer(3))).toBe(3);
  });

  it("round-trips a string answer", () => {
    expect(decryptAnswer<string>(encryptAnswer("yes"))).toBe("yes");
  });

  it("round-trips a boolean answer", () => {
    expect(decryptAnswer<boolean>(encryptAnswer(true))).toBe(true);
    expect(decryptAnswer<boolean>(encryptAnswer(false))).toBe(false);
  });

  it("round-trips null", () => {
    expect(decryptAnswer<null>(encryptAnswer(null))).toBe(null);
  });

  it("round-trips an array of strings", () => {
    const value = ["governance", "cyber", "physical", "financial"];
    expect(decryptAnswer<string[]>(encryptAnswer(value))).toEqual(value);
  });

  it("round-trips a nested object payload", () => {
    const value = {
      score: 4,
      details: { confidence: "high", notes: "Verified by interview." },
      flags: ["primary", "reviewed"],
    };
    expect(decryptAnswer<typeof value>(encryptAnswer(value))).toEqual(value);
  });

  it("produces a different ciphertext on each call (random IV)", () => {
    expect(encryptAnswer({ a: 1 })).not.toBe(encryptAnswer({ a: 1 }));
  });

  it("throws on tampered ciphertext", () => {
    const ct = encryptAnswer({ pillar: "cyber", score: 5 });
    const parts = ct.split(":");
    const bytes = parts[2].split("");
    bytes[0] = bytes[0] === "a" ? "b" : "a";
    const tampered = `${parts[0]}:${parts[1]}:${bytes.join("")}`;
    expect(() => decryptAnswer(tampered)).toThrow();
  });

  it("throws on ciphertext that decrypts to invalid JSON", () => {
    // Encrypt a non-JSON string via the lower-level transcription
    // helper (same encryption format) — decryptAnswer will decrypt
    // successfully but then JSON.parse will throw.
    const garbageJson = encryptTranscription("definitely { not valid JSON");
    expect(() => decryptAnswer(garbageJson)).toThrow(SyntaxError);
  });
});
