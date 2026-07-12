import { describe, expect, it } from "vitest";
import {
  buildQuestionNarrationText,
  questionTtsBodySchema,
} from "@/lib/tts/question-tts-body";

describe("questionTtsBodySchema", () => {
  it("accepts narration text only", () => {
    const parsed = questionTtsBodySchema.safeParse({
      questionText: "How did your advisor describe our firm?",
    });
    expect(parsed.success).toBe(true);
  });

  it("ignores legacy optional fields that are no longer spoken", () => {
    const longTip = "x".repeat(600);
    const parsed = questionTtsBodySchema.safeParse({
      questionText: "Question prompt",
      context: "y".repeat(5000),
      recordingTips: [longTip],
      moduleName: "Governance",
      questionNumber: 1,
      totalQuestions: 12,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty question text", () => {
    const parsed = questionTtsBodySchema.safeParse({ questionText: "" });
    expect(parsed.success).toBe(false);
  });
});

describe("buildQuestionNarrationText", () => {
  it("reads only the question prompt", () => {
    expect(
      buildQuestionNarrationText({
        questionText: "  What is your household size?  ",
        questionNumber: 2,
        totalQuestions: 10,
        recordingTips: ["Speak clearly"],
        context: "Coaching copy is not spoken",
      }),
    ).toBe("What is your household size?");
  });
});
