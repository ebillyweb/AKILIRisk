import { describe, it, expect } from "vitest";
import { formatAssessmentAnswerForDisplay } from "./format-assessment-answer";

describe("formatAssessmentAnswerForDisplay", () => {
  it("labels skipped responses", () => {
    expect(formatAssessmentAnswerForDisplay(undefined, null, true)).toBe("Skipped");
  });

  it("labels skipped document-upload responses for reviewers", () => {
    expect(
      formatAssessmentAnswerForDisplay(
        { type: "document-upload", options: [] },
        null,
        true
      )
    ).toBe("No documents attached — client continued without upload");
  });

  it("formats maturity-scale with rubric label", () => {
    expect(
      formatAssessmentAnswerForDisplay({ type: "maturity-scale", options: [] }, 2, false)
    ).toContain("2");
  });

  it("formats calendar date answers", () => {
    expect(
      formatAssessmentAnswerForDisplay({ type: "date", options: [] }, "2024-03-01", false)
    ).toBe("March 1, 2024");
    expect(
      formatAssessmentAnswerForDisplay(
        { type: "month-year", options: [] },
        "2024-03",
        false
      )
    ).toBe("March 2024");
  });
});
