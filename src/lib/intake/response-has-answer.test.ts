import { describe, expect, it } from "vitest";
import { intakeResponseHasClientAnswer } from "@/lib/intake/response-has-answer";

describe("intakeResponseHasClientAnswer", () => {
  it("returns false for advisor-note placeholder rows", () => {
    expect(
      intakeResponseHasClientAnswer({
        answeredAt: null,
        audioUrl: null,
        hasTranscription: false,
        transcription: null,
      }),
    ).toBe(false);
  });

  it("returns true when transcription exists", () => {
    expect(
      intakeResponseHasClientAnswer({
        hasTranscription: true,
      }),
    ).toBe(true);
  });
});
