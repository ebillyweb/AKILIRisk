import { describe, expect, it } from "vitest";
import { isInterviewResponseComplete } from "@/lib/intake/is-response-complete";

describe("isInterviewResponseComplete", () => {
  it("treats skipped responses as complete", () => {
    expect(
      isInterviewResponseComplete({
        skipped: true,
        status: "completed",
      }),
    ).toBe(true);
  });

  it("requires completed typed text without audio", () => {
    expect(
      isInterviewResponseComplete({
        transcription: "hello",
        status: "completed",
      }),
    ).toBe(true);
    expect(
      isInterviewResponseComplete({
        transcription: "   ",
        status: "completed",
      }),
    ).toBe(false);
  });
});
