import { formatAssessmentAnswerForDisplay } from "@/lib/admin/format-assessment-answer";
import { pillarDisplayName } from "@/lib/assessment/included-pillars";
import { starterPillarCatalog } from "@/lib/methodology/pillar-catalog";
import type { AdvisorAssessmentReviewPayload } from "@/lib/advisor/assessment-review-queries";

export type AssessmentPdfResponseRow = {
  index: number;
  questionText: string;
  pillarLabel: string;
  subCategoryLabel: string;
  answerText: string;
  advisorNote?: string;
};

export type AssessmentPdfData = {
  clientName: string;
  clientEmail: string;
  completedAt: string | null;
  assessmentStatus: string;
  version: number;
  responseCount: number;
  responses: AssessmentPdfResponseRow[];
};

function formatSubCategoryLabel(subCategory: string): string {
  return subCategory.replace(/-/g, " ");
}

/** Builds a serializable assessment Q&A payload for PDF rendering. */
export function buildAssessmentPdfData(
  review: AdvisorAssessmentReviewPayload,
): AssessmentPdfData {
  const { assessment, questionsById } = review;

  const responses = assessment.responses.map((row, index) => {
    const question = questionsById[row.questionId];
    const questionText = question?.text ?? row.questionId;

    return {
      index: index + 1,
      questionText,
      pillarLabel: pillarDisplayName(row.pillar, starterPillarCatalog()),
      subCategoryLabel: formatSubCategoryLabel(row.subCategory),
      answerText: formatAssessmentAnswerForDisplay(
        question,
        row.answer,
        row.skipped,
      ),
      advisorNote: row.advisorNote?.body?.trim() || undefined,
    };
  });

  const completedAt = assessment.completedAt
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(assessment.completedAt))
    : null;

  return {
    clientName: assessment.user.name || "Unnamed Client",
    clientEmail: assessment.user.email,
    completedAt,
    assessmentStatus: assessment.status,
    version: assessment.version,
    responseCount: responses.length,
    responses,
  };
}

export function isAssessmentExportableStatus(status: string): boolean {
  return status === "COMPLETED";
}
