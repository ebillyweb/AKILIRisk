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

  it("prefers question-specific maturity labels over generic rubric", () => {
    expect(
      formatAssessmentAnswerForDisplay(
        {
          type: "maturity-scale",
          options: [{ value: 0, label: "Filed independently, no broker" }],
        },
        0,
        false
      )
    ).toBe("Filed independently, no broker");
  });

  it("falls back to rubric label when options are missing", () => {
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

  it("joins multi-choice selections into a readable label list", () => {
    expect(
      formatAssessmentAnswerForDisplay(
        {
          type: "multi-choice",
          options: [
            { value: "MFA", label: "Multi-factor auth" },
            { value: "Backups", label: "Offsite backups" },
            { value: "Encryption", label: "Full-disk encryption" },
          ],
        },
        ["MFA", "Encryption"],
        false
      )
    ).toBe("Multi-factor auth, Full-disk encryption");
  });

  it("treats an empty multi-choice selection as no answer", () => {
    expect(
      formatAssessmentAnswerForDisplay(
        { type: "multi-choice", options: [{ value: "MFA", label: "MFA" }] },
        [],
        false
      )
    ).toBe("No answer recorded");
  });
});
