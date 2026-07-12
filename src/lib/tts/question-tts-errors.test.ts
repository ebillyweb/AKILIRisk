import { describe, expect, it } from "vitest";
import {
  mapQuestionTtsError,
  QUESTION_TTS_UNAVAILABLE_MESSAGE,
} from "@/lib/tts/question-tts-errors";

describe("mapQuestionTtsError", () => {
  it("maps OpenAI quota exhaustion to client-safe 503 copy", () => {
    expect(
      mapQuestionTtsError({
        status: 429,
        code: "insufficient_quota",
        message: "You exceeded your current quota",
      }),
    ).toEqual({
      status: 503,
      error: QUESTION_TTS_UNAVAILABLE_MESSAGE,
    });
  });

  it("maps other OpenAI rate limits to the same client-safe copy", () => {
    expect(
      mapQuestionTtsError({
        status: 429,
        code: "rate_limit_exceeded",
      }),
    ).toEqual({
      status: 503,
      error: QUESTION_TTS_UNAVAILABLE_MESSAGE,
    });
  });

  it("maps unknown failures to client-safe 500 copy", () => {
    expect(mapQuestionTtsError(new Error("network down"))).toEqual({
      status: 500,
      error: QUESTION_TTS_UNAVAILABLE_MESSAGE,
    });
  });
});
