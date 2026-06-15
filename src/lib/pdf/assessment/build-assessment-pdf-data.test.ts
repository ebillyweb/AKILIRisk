import { describe, expect, it } from "vitest";
import {
  buildAssessmentPdfData,
  isAssessmentExportableStatus,
} from "@/lib/pdf/assessment/build-assessment-pdf-data";
import type { AdvisorAssessmentReviewPayload } from "@/lib/advisor/assessment-review-queries";

function makeReview(
  overrides?: Partial<AdvisorAssessmentReviewPayload>,
): AdvisorAssessmentReviewPayload {
  return {
    assessment: {
      id: "asmt-1",
      status: "COMPLETED",
      version: 2,
      completedAt: new Date("2026-06-01T15:00:00.000Z"),
      user: {
        id: "user-1",
        name: "Jane Client",
        email: "jane@example.com",
      },
      responses: [
        {
          responseId: "resp-1",
          questionId: "gov-q1",
          pillar: "governance",
          subCategory: "decision-rights",
          answer: 3,
          skipped: false,
          answeredAt: "2026-06-01T14:00:00.000Z",
          advisorNote: {
            id: "note-1",
            body: "Strong council structure.",
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        },
      ],
    },
    questionsById: {
      "gov-q1": {
        id: "gov-q1",
        text: "How are family decisions documented?",
        type: "maturity-scale",
        options: [],
        helpText: undefined,
        learnMore: undefined,
      },
    },
    ...overrides,
  };
}

describe("isAssessmentExportableStatus", () => {
  it("allows completed assessments only", () => {
    expect(isAssessmentExportableStatus("COMPLETED")).toBe(true);
    expect(isAssessmentExportableStatus("IN_PROGRESS")).toBe(false);
  });
});

describe("buildAssessmentPdfData", () => {
  it("maps assessment responses, labels, and advisor notes", () => {
    const data = buildAssessmentPdfData(makeReview());

    expect(data.clientName).toBe("Jane Client");
    expect(data.version).toBe(2);
    expect(data.responseCount).toBe(1);
    expect(data.responses[0]).toMatchObject({
      index: 1,
      questionText: "How are family decisions documented?",
      pillarLabel: "Governance",
      subCategoryLabel: "decision rights",
      advisorNote: "Strong council structure.",
    });
    expect(data.responses[0]?.answerText).toContain("3");
  });
});
