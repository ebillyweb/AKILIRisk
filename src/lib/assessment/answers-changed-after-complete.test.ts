import { describe, expect, it } from "vitest";
import {
  assessmentNeedsRescore,
  assessmentStoredAnswerChanged,
} from "@/lib/assessment/answers-changed-after-complete";

describe("assessmentStoredAnswerChanged", () => {
  it("detects answer value changes", () => {
    expect(
      assessmentStoredAnswerChanged({
        priorSkipped: false,
        priorAnswer: "yes",
        nextSkipped: false,
        nextAnswer: "no",
      }),
    ).toBe(true);
  });

  it("ignores identical answers", () => {
    expect(
      assessmentStoredAnswerChanged({
        priorSkipped: false,
        priorAnswer: { tier: 2 },
        nextSkipped: false,
        nextAnswer: { tier: 2 },
      }),
    ).toBe(false);
  });

  it("detects skipped state changes", () => {
    expect(
      assessmentStoredAnswerChanged({
        priorSkipped: false,
        priorAnswer: "yes",
        nextSkipped: true,
        nextAnswer: null,
      }),
    ).toBe(true);
  });

  it("ignores skipped-to-skipped updates", () => {
    expect(
      assessmentStoredAnswerChanged({
        priorSkipped: true,
        priorAnswer: null,
        nextSkipped: true,
        nextAnswer: null,
      }),
    ).toBe(false);
  });
});

describe("assessmentNeedsRescore", () => {
  it("is true only for completed assessments with a change timestamp", () => {
    expect(
      assessmentNeedsRescore({
        status: "COMPLETED",
        answersChangedAfterCompleteAt: new Date(),
      }),
    ).toBe(true);
    expect(
      assessmentNeedsRescore({
        status: "IN_PROGRESS",
        answersChangedAfterCompleteAt: new Date(),
      }),
    ).toBe(false);
    expect(
      assessmentNeedsRescore({
        status: "COMPLETED",
        answersChangedAfterCompleteAt: null,
      }),
    ).toBe(false);
  });
});
