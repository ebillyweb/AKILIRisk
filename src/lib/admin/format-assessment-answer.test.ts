import { describe, it, expect } from "vitest";
import { formatAssessmentAnswerForDisplay } from "./format-assessment-answer";

describe("formatAssessmentAnswerForDisplay", () => {
  it("labels skipped responses", () => {
    expect(formatAssessmentAnswerForDisplay(undefined, null, true)).toBe("Skipped");
  });

  it("formats maturity-scale with rubric label", () => {
    expect(
      formatAssessmentAnswerForDisplay({ type: "maturity-scale", options: [] }, 2, false)
    ).toContain("2");
  });
});
