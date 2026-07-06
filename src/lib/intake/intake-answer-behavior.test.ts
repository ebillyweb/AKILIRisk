import { describe, expect, it } from "vitest";
import {
  formatIntakeStructuredAnswerForDisplay,
  intakeChoiceOptions,
  intakeUsesFreeformResponse,
  normalizeIntakeAnswerType,
} from "./intake-answer-behavior";

describe("intake answer behavior", () => {
  it("treats fillable and legacy audio as freeform responses", () => {
    expect(intakeUsesFreeformResponse("fillable")).toBe(true);
    expect(intakeUsesFreeformResponse("audio")).toBe(true);
    expect(intakeUsesFreeformResponse("yes_no")).toBe(false);
    expect(intakeUsesFreeformResponse("choice_list")).toBe(false);
  });

  it("normalizes legacy audio to fillable", () => {
    expect(normalizeIntakeAnswerType("audio")).toBe("fillable");
    expect(normalizeIntakeAnswerType("yes_no")).toBe("yes_no");
  });

  it("builds yes/no choice labels from answer fields", () => {
    expect(
      intakeChoiceOptions({
        answerType: "yes_no",
        answer0: "Nope",
        answer1: "Yep",
      }),
    ).toEqual([
      { value: "yes", label: "Yep" },
      { value: "no", label: "Nope" },
    ]);
  });

  it("builds choice_list options from stored JSON", () => {
    expect(
      intakeChoiceOptions({
        answerType: "choice_list",
        options: [
          { value: "0", label: "Low" },
          { value: "1", label: "High" },
        ],
      }),
    ).toEqual([
      { value: "0", label: "Low" },
      { value: "1", label: "High" },
    ]);
  });

  it("formats choice_list stored values as labels", () => {
    expect(
      formatIntakeStructuredAnswerForDisplay(
        {
          answerType: "choice_list",
          options: [
            { value: "0", label: "Retired" },
            { value: "1", label: "Employed" },
          ],
        },
        "1",
      ),
    ).toBe("Employed");
  });
});
