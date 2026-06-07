import { describe, expect, it } from "vitest";
import {
  dateAnswerNeedsReviewerAttention,
  formatDateAnswerForDisplay,
  formatMonthYearAnswerForDisplay,
  isAssessmentDateOlderThanMonths,
  isDateQuestionText,
  isIsoDateAnswer,
  isIsoMonthYearAnswer,
  isMonthYearQuestionText,
  parseAssessmentDateAnswer,
} from "./question-date";

const NOW = new Date("2025-06-07T12:00:00Z");

describe("question-date helpers", () => {
  it("detects calendar date prompts", () => {
    expect(isDateQuestionText("When was the last meeting?")).toBe(true);
    expect(isDateQuestionText("What date was the trust established?")).toBe(true);
    expect(isDateQuestionText("Describe these meetings")).toBe(false);
  });

  it("routes month-precision prompts to month-year", () => {
    expect(
      isMonthYearQuestionText(
        "When was the last time your personal insurance coverages were reviewed?"
      )
    ).toBe(true);
    expect(isDateQuestionText("When was the last meeting?")).toBe(true);
    expect(
      isDateQuestionText(
        "When was the last time your personal insurance coverages were reviewed?"
      )
    ).toBe(false);
  });

  it("validates ISO date strings", () => {
    expect(isIsoDateAnswer("2024-06-15")).toBe(true);
    expect(isIsoDateAnswer("2024-06")).toBe(false);
    expect(isIsoMonthYearAnswer("2024-06")).toBe(true);
  });

  it("formats dates for display", () => {
    expect(formatDateAnswerForDisplay("2024-06-15")).toBe("June 15, 2024");
    expect(formatMonthYearAnswerForDisplay("2024-06")).toBe("June 2024");
  });

  it("parses calendar and month-year answers as UTC dates", () => {
    expect(parseAssessmentDateAnswer("date", "2024-06-15")?.toISOString()).toBe(
      "2024-06-15T00:00:00.000Z"
    );
    expect(parseAssessmentDateAnswer("month-year", "2024-06")?.toISOString()).toBe(
      "2024-06-30T00:00:00.000Z"
    );
    expect(parseAssessmentDateAnswer("short-text", "2024-06-15")).toBeNull();
  });

  describe("stale date reviewer flag (>12 months)", () => {
    it("flags calendar dates strictly older than 12 months", () => {
      expect(
        isAssessmentDateOlderThanMonths("date", "2024-05-01", 12, NOW)
      ).toBe(true);
      expect(
        isAssessmentDateOlderThanMonths("date", "2024-06-15", 12, NOW)
      ).toBe(false);
    });

    it("flags month-year answers when that month ended more than 12 months ago", () => {
      expect(
        isAssessmentDateOlderThanMonths("month-year", "2024-04", 12, NOW)
      ).toBe(true);
      expect(
        isAssessmentDateOlderThanMonths("month-year", "2024-06", 12, NOW)
      ).toBe(false);
    });

    it("uses the shared reviewer attention helper for date question types only", () => {
      expect(dateAnswerNeedsReviewerAttention("date", "2024-05-01", NOW)).toBe(true);
      expect(dateAnswerNeedsReviewerAttention("date", "2024-06-15", NOW)).toBe(false);
      expect(dateAnswerNeedsReviewerAttention("month-year", "2024-04", NOW)).toBe(true);
      expect(dateAnswerNeedsReviewerAttention("maturity-scale", "2024-05-01", NOW)).toBe(
        false
      );
      expect(dateAnswerNeedsReviewerAttention("date", "not-a-date", NOW)).toBe(false);
    });
  });
});
