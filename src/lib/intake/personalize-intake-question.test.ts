import { describe, expect, it } from "vitest";
import {
  personalizeIntakeQuestionText,
  personalizeIntakeScript,
} from "./personalize-intake-question";
import type { IntakeQuestion } from "./types";

const sampleQuestion: IntakeQuestion = {
  id: "q1",
  questionNumber: 1,
  questionText:
    "How did your financial advisor describe what we do at {{firmName}}?",
  context: "Speak with {{firmName}} in mind.",
  whyThisMatters: "Helps us align with {{firmName}}.",
  recordingTips: ["Speak clearly"],
};

describe("personalizeIntakeQuestionText", () => {
  it("substitutes the firm name placeholder", () => {
    expect(
      personalizeIntakeQuestionText(
        "What we do at {{firmName}}?",
        "Ebilly Wealth"
      )
    ).toBe("What we do at Ebilly Wealth?");
  });

  it("falls back when firm name is missing", () => {
    expect(
      personalizeIntakeQuestionText("What we do at {{firmName}}?", null)
    ).toBe("What we do at your advisor?");
  });

  it("rewrites legacy platform firm names and AKILI copy", () => {
    expect(
      personalizeIntakeQuestionText(
        "How did your advisor describe what we do at Belvedere?",
        "Test Advisory Firm"
      )
    ).toBe(
      "How did your advisor describe what we do at Test Advisory Firm?"
    );
    expect(
      personalizeIntakeQuestionText(
        "How did your advisor describe what we do at AKILI?",
        "Test Advisory Firm"
      )
    ).toBe(
      "How did your advisor describe what we do at Test Advisory Firm?"
    );
  });
});

describe("personalizeIntakeScript", () => {
  it("personalizes all client-facing text fields", () => {
    const [question] = personalizeIntakeScript([sampleQuestion], "Ebilly Wealth");
    expect(question.questionText).toContain("Ebilly Wealth");
    expect(question.context).toContain("Ebilly Wealth");
    expect(question.whyThisMatters).toContain("Ebilly Wealth");
  });
});
