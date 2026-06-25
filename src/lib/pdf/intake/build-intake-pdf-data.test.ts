import { describe, expect, it } from "vitest";
import {
  buildIntakePdfData,
  isIntakeExportableStatus,
} from "@/lib/pdf/intake/build-intake-pdf-data";
import type { IntakeReviewData } from "@/lib/advisor/types";

function makeReview(overrides?: Partial<IntakeReviewData>): IntakeReviewData {
  return {
    interview: {
      id: "int-1",
      userId: "user-1",
      status: "SUBMITTED",
      submittedAt: new Date("2026-06-01T12:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
      currentQuestionIndex: 0,
      reassessmentOfInterviewId: null,
      user: {
        id: "user-1",
        name: "Jane Client",
        email: "jane@example.com",
      },
      responses: [
        {
          id: "resp-1",
          interviewId: "int-1",
          questionId: "intake-q1",
          transcription: "Family governance council meets monthly.",
          audioUrl: null,
          audioS3Key: null,
          audioDuration: null,
          transcriptionStatus: "COMPLETED",
          createdAt: new Date(),
          updatedAt: new Date(),
          advisorNote: {
            id: "note-1",
            body: "Strong governance rhythm.",
            updatedAt: "2026-06-02T10:00:00.000Z",
          },
        },
      ],
    },
    approval: null,
    pillarRecommendations: [],
    assessmentDomains: [],
    assessmentDomainPicker: {
      domains: [],
      platformTotal: 0,
      inactiveDomains: [],
    },
    assignmentAdvisorProfileId: "advisor-1",
    householdMembers: [],
    questions: [
      {
        id: "intake-q1",
        text: "How does your family make decisions?",
        questionNumber: 1,
        questionText: "How does your family make decisions?",
        type: "audio",
      },
      {
        id: "intake-q2",
        text: "Who holds authority?",
        questionNumber: 2,
        questionText: "Who holds authority?",
        type: "audio",
      },
    ],
    ...overrides,
  };
}

describe("isIntakeExportableStatus", () => {
  it("allows submitted and completed", () => {
    expect(isIntakeExportableStatus("SUBMITTED")).toBe(true);
    expect(isIntakeExportableStatus("COMPLETED")).toBe(true);
  });

  it("blocks in-progress intake", () => {
    expect(isIntakeExportableStatus("IN_PROGRESS")).toBe(false);
  });
});

describe("buildIntakePdfData", () => {
  it("maps questions and advisor notes for PDF export", () => {
    const data = buildIntakePdfData(makeReview());

    expect(data.clientName).toBe("Jane Client");
    expect(data.responseCount).toBe(1);
    expect(data.totalQuestions).toBe(2);
    expect(data.questions).toHaveLength(2);
    expect(data.questions[0]).toMatchObject({
      questionNumber: 1,
      answerText: "Family governance council meets monthly.",
      advisorNote: "Strong governance rhythm.",
    });
    expect(data.questions[1].answerText).toContain("No response");
  });
});
