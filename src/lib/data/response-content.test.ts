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

/**
 * Round-11 cleanup — tamper-resilient decrypt wrappers. The contract:
 *   - valid ciphertext → decrypted value (no warn)
 *   - null / undefined / empty input → null (no warn — empty is normal)
 *   - corrupted ciphertext → null + console.warn(rowId, column)
 *   - invalid-JSON ciphertext (safeDecryptAnswer only) → null + warn
 *
 * The console.warn payload MUST NOT include the ciphertext or the
 * raw error message — both could carry partial key material in some
 * AES-GCM failure modes.
 */
describe("safeDecryptTranscription", () => {
  it("round-trips a valid ciphertext without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plain = "valid transcription content";
    const ct = encryptTranscription(plain);
    expect(
      safeDecryptTranscription(ct, { rowId: "ir-1", column: "IntakeResponse.transcription" })
    ).toBe(plain);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for null input without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      safeDecryptTranscription(null, { rowId: "ir-2", column: "IntakeResponse.transcription" })
    ).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for undefined input without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      safeDecryptTranscription(undefined, { rowId: "ir-3", column: "IntakeResponse.transcription" })
    ).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null + warns with rowId/column on tampered ciphertext", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ct = encryptTranscription("integrity-protected");
    const parts = ct.split(":");
    const bytes = parts[2].split("");
    bytes[0] = bytes[0] === "a" ? "b" : "a";
    const tampered = `${parts[0]}:${parts[1]}:${bytes.join("")}`;

    const out = safeDecryptTranscription(tampered, {
      rowId: "ir-tamper",
      column: "IntakeResponse.transcription",
    });
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain("ir-tamper");
    expect(msg).toContain("IntakeResponse.transcription");
    // The warning must NOT leak the ciphertext or the raw error message.
    expect(msg).not.toContain(tampered);
    expect(msg).not.toContain(parts[0]);
    expect(msg).not.toContain(parts[1]);
    warn.mockRestore();
  });

  it("returns null + warns on malformed input that isn't iv:tag:ct", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const out = safeDecryptTranscription("not-a-ciphertext-at-all", {
      rowId: "ir-malformed",
      column: "IntakeResponse.transcription",
    });
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe("safeDecryptAnswer", () => {
  it("round-trips a valid ciphertext without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const value = { score: 4, notes: "verified" };
    const ct = encryptAnswer(value);
    expect(
      safeDecryptAnswer<typeof value>(ct, {
        rowId: "ar-1",
        column: "AssessmentResponse.answer",
      })
    ).toEqual(value);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for null input without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      safeDecryptAnswer(null, { rowId: "ar-2", column: "AssessmentResponse.answer" })
    ).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for undefined input without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      safeDecryptAnswer(undefined, { rowId: "ar-3", column: "AssessmentResponse.answer" })
    ).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null for empty string without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      safeDecryptAnswer("", { rowId: "ar-4", column: "AssessmentResponse.answer" })
    ).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("returns null + warns with rowId/column on tampered ciphertext", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ct = encryptAnswer({ pillar: "cyber", score: 5 });
    const parts = ct.split(":");
    const bytes = parts[2].split("");
    bytes[0] = bytes[0] === "a" ? "b" : "a";
    const tampered = `${parts[0]}:${parts[1]}:${bytes.join("")}`;

    const out = safeDecryptAnswer(tampered, {
      rowId: "ar-tamper",
      column: "AssessmentResponse.answer",
    });
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0][0]);
    expect(msg).toContain("ar-tamper");
    expect(msg).toContain("AssessmentResponse.answer");
    expect(msg).not.toContain(tampered);
    warn.mockRestore();
  });

  it("returns null + warns when ciphertext decrypts to invalid JSON", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Encrypt a non-JSON payload via the lower-level transcription
    // helper. decryptAnswer will succeed at AES-GCM but JSON.parse
    // throws — the safe wrapper must catch that too.
    const garbage = encryptTranscription("definitely { not valid JSON");
    const out = safeDecryptAnswer(garbage, {
      rowId: "ar-json",
      column: "AssessmentResponse.answer",
    });
    expect(out).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
