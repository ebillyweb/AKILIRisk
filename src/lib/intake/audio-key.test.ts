import { describe, it, expect } from "vitest";
import {
  intakeAudioKey,
  intakeAudioPrefix,
  isOwnedIntakeAudioKey,
  sanitizeQuestionId,
} from "./audio-key";

describe("intake audio-key helpers", () => {
  it("builds an interview-scoped prefix", () => {
    expect(intakeAudioPrefix("intv-1")).toBe("intake/intv-1/");
  });

  it("is deterministic for the same interview+question (idempotent retries)", () => {
    expect(intakeAudioKey("intv-1", "q1")).toBe("intake/intv-1/q1.m4a");
    expect(intakeAudioKey("intv-1", "q1")).toBe(intakeAudioKey("intv-1", "q1"));
  });

  it("sanitizes path-traversal / slash characters out of the questionId", () => {
    expect(sanitizeQuestionId("../../etc/passwd")).toBe("etcpasswd");
    expect(intakeAudioKey("intv-1", "../escape")).toBe("intake/intv-1/escape.m4a");
  });

  it("accepts only keys inside the interview's namespace", () => {
    expect(isOwnedIntakeAudioKey("intake/intv-1/q1.m4a", "intv-1")).toBe(true);
    expect(isOwnedIntakeAudioKey("intake/intv-1/q1/123.m4a", "intv-1")).toBe(true);
  });

  it("rejects cross-interview, cross-prefix, and empty keys", () => {
    expect(isOwnedIntakeAudioKey("intake/OTHER/q1.m4a", "intv-1")).toBe(false);
    expect(isOwnedIntakeAudioKey("documents/intv-1/secret.pdf", "intv-1")).toBe(false);
    expect(isOwnedIntakeAudioKey(null, "intv-1")).toBe(false);
    expect(isOwnedIntakeAudioKey(undefined, "intv-1")).toBe(false);
    // Prefix-collision guard: a different interview that shares a leading substring.
    expect(isOwnedIntakeAudioKey("intake/intv-12/q1.m4a", "intv-1")).toBe(false);
  });
});
