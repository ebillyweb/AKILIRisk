import { describe, expect, it } from "vitest";
import {
  intakeChoiceOptions,
  intakeUsesFreeformResponse,
  normalizeIntakeAnswerType,
} from "./intake-answer-behavior";

describe("intake answer behavior", () => {
  it("treats fillable and legacy audio as freeform responses", () => {
    expect(intakeUsesFreeformResponse("fillable")).toBe(true);
    expect(intakeUsesFreeformResponse("audio")).toBe(true);
    expect(intakeUsesFreeformResponse("yes_no")).toBe(false);
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
});
