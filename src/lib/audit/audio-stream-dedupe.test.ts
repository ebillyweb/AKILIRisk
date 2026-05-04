import { describe, it, expect, beforeEach } from "vitest";
import {
  shouldAuditAudioStream,
  clearAudioStreamDedupe,
  audioStreamDedupe,
} from "./audio-stream-dedupe";

beforeEach(() => {
  clearAudioStreamDedupe();
});

describe("shouldAuditAudioStream", () => {
  const ACTOR = "advisor-1";
  const INTERVIEW = "iv-1";
  const QUESTION = "q-1";

  it("returns true on first access", () => {
    expect(shouldAuditAudioStream(ACTOR, INTERVIEW, QUESTION, 1000)).toBe(true);
  });

  it("returns false for the same tuple within the 5-minute window", () => {
    expect(shouldAuditAudioStream(ACTOR, INTERVIEW, QUESTION, 1000)).toBe(true);
    // 4 minutes 59 seconds later — still in the window
    expect(shouldAuditAudioStream(ACTOR, INTERVIEW, QUESTION, 1000 + 4 * 60 * 1000 + 59 * 1000)).toBe(false);
  });

  it("returns true for the same tuple after the 5-minute window", () => {
    expect(shouldAuditAudioStream(ACTOR, INTERVIEW, QUESTION, 1000)).toBe(true);
    // 5 minutes 1 second later — past the window
    expect(shouldAuditAudioStream(ACTOR, INTERVIEW, QUESTION, 1000 + 5 * 60 * 1000 + 1000)).toBe(true);
  });

  it("treats different actors as separate", () => {
    expect(shouldAuditAudioStream("a-1", INTERVIEW, QUESTION, 1000)).toBe(true);
    expect(shouldAuditAudioStream("a-2", INTERVIEW, QUESTION, 1000)).toBe(true);
  });

  it("treats different interviews as separate", () => {
    expect(shouldAuditAudioStream(ACTOR, "iv-a", QUESTION, 1000)).toBe(true);
    expect(shouldAuditAudioStream(ACTOR, "iv-b", QUESTION, 1000)).toBe(true);
  });

  it("treats different questions as separate", () => {
    expect(shouldAuditAudioStream(ACTOR, INTERVIEW, "q-a", 1000)).toBe(true);
    expect(shouldAuditAudioStream(ACTOR, INTERVIEW, "q-b", 1000)).toBe(true);
  });

  it("garbage-collects entries older than 10 min when map grows past threshold", () => {
    // Seed 1001 entries with old timestamps, then trigger one new entry to force the cleanup pass.
    for (let i = 0; i < 1001; i++) {
      shouldAuditAudioStream(`a-${i}`, INTERVIEW, QUESTION, 0); // very old
    }
    expect(audioStreamDedupe.size).toBe(1001);

    // 11 minutes later, a new entry triggers the cleanup pass which drops
    // every entry older than (now - 10 min) — i.e. all 1001 seeded entries.
    shouldAuditAudioStream("new-actor", INTERVIEW, QUESTION, 11 * 60 * 1000);
    // The new entry is still there; the 1001 old ones got swept.
    expect(audioStreamDedupe.size).toBe(1);
    expect(audioStreamDedupe.has("new-actor:iv-1:q-1")).toBe(true);
  });

  it("does not garbage-collect when map is below the size threshold", () => {
    for (let i = 0; i < 500; i++) {
      shouldAuditAudioStream(`a-${i}`, INTERVIEW, QUESTION, 0);
    }
    expect(audioStreamDedupe.size).toBe(500);

    // Even far in the future, no cleanup happens because we're below threshold.
    shouldAuditAudioStream("new-actor", INTERVIEW, QUESTION, 60 * 60 * 1000);
    expect(audioStreamDedupe.size).toBe(501);
  });
});
