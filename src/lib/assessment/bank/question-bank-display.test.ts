import { describe, expect, it } from "vitest";
import {
  formatQuestionTextForDisplay,
  getAnswerOptionFields,
} from "./question-bank-display";

describe("formatQuestionTextForDisplay", () => {
  it("strips trailing bracket reference tags", () => {
    expect(
      formatQuestionTextForDisplay(
        "How have you documented your mission? [pw-1779594881653]"
      )
    ).toBe("How have you documented your mission?");
  });

  it("leaves text without trailing tags unchanged", () => {
    const text = "What is your family governance structure?";
    expect(formatQuestionTextForDisplay(text)).toBe(text);
  });
});

describe("getAnswerOptionFields", () => {
  it("returns four maturity labels for scored_0_3", () => {
    const fields = getAnswerOptionFields("scored_0_3", {
      answer0: "None",
      answer1: "Verbal only",
      answer2: "Partial",
      answer3: "Full",
    });
    expect(fields).toHaveLength(4);
    expect(fields[0].label).toMatch(/score 0/i);
    expect(fields[0].defaultValue).toBe("None");
  });

  it("returns no fields for short-text types", () => {
    expect(
      getAnswerOptionFields("fillable", {
        answer0: "",
        answer1: "",
        answer2: "",
        answer3: "",
      })
    ).toHaveLength(0);
  });
});
