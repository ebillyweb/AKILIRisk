import "server-only";

import { getAdvisorProfileOrThrow, requireAdvisorRole } from "@/lib/advisor/auth";
import { loadGovernanceQuestionsMerged } from "@/lib/assessment/bank/load-bank";
import {
  indexQuestionsForReview,
  type QuestionReviewContext,
} from "@/lib/assessment/question-review-context";
import { decryptUserEmail } from "@/lib/auth/user-email-crypto";
import { safeDecryptAnswer } from "@/lib/data/response-content";
import { prisma } from "@/lib/db";

/**
 * US-46c: advisor-facing per-answer drill-in for a client's assessment.
 * Tenant isolation: this query returns `null` unless the calling advisor
 * has an ACTIVE ClientAdvisorAssignment to the assessment's owner. The
 * `advisorNotes` join is filtered by `advisorId = <calling advisor user>`
 * so two co-advisors on the same client see only their own notes — admin
 * staff use a different query (admin-assessment-review-queries.ts) that
 * shows all admin notes regardless of advisor scope.
 */

export type AdvisorAssessmentResponseNoteView = {
  id: string;
  body: string;
  updatedAt: string;
};

export type AdvisorAssessmentReviewRow = {
  responseId: string;
  questionId: string;
  pillar: string;
  subCategory: string;
  answer: unknown;
  skipped: boolean;
  answeredAt: string;
  advisorNote: AdvisorAssessmentResponseNoteView | null;
};

export type AdvisorAssessmentReviewPayload = {
  assessment: {
    id: string;
    status: string;
    version: number;
    completedAt: Date | null;
    user: { id: string; name: string | null; email: string };
    responses: AdvisorAssessmentReviewRow[];
  };
  questionsById: Record<string, QuestionReviewContext>;
};

export async function getAssessmentForAdvisorReview(
  assessmentId: string,
): Promise<AdvisorAssessmentReviewPayload | null> {
  const { userId } = await requireAdvisorRole();
  const profile = await getAdvisorProfileOrThrow(userId);

  // Tenant gate: the assessment's owner must have an ACTIVE assignment to
  // this advisor. Anything else returns null so non-assigned advisors
  // can't probe assessment existence.
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      user: {
        clientAssignments: {
          some: {
            advisorId: profile.id,
            status: "ACTIVE",
          },
        },
      },
    },
    select: {
      id: true,
      status: true,
      version: true,
      completedAt: true,
      user: { select: { id: true, name: true, emailCiphertext: true } },
      responses: {
        orderBy: { answeredAt: "asc" },
        select: {
          id: true,
          questionId: true,
          pillar: true,
          subCategory: true,
          answer: true,
          skipped: true,
          answeredAt: true,
          advisorNotes: {
            where: { advisorId: userId },
            select: { id: true, body: true, updatedAt: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!assessment) return null;

  const allQuestions = await loadGovernanceQuestionsMerged({ onlyVisible: true });
  const questionsById = indexQuestionsForReview(allQuestions);

  return {
    assessment: {
      id: assessment.id,
      status: assessment.status,
      version: assessment.version,
      completedAt: assessment.completedAt,
      user: {
        id: assessment.user.id,
        name: assessment.user.name,
        email: decryptUserEmail(assessment.user.emailCiphertext),
      },
      responses: assessment.responses.map((r) => {
        const note = r.advisorNotes && r.advisorNotes.length > 0 ? r.advisorNotes[0] : null;
        return {
          responseId: r.id,
          questionId: r.questionId,
          pillar: r.pillar,
          subCategory: r.subCategory,
          answer: safeDecryptAnswer(r.answer as string | null, {
            rowId: r.id,
            column: "AssessmentResponse.answer",
          }),
          skipped: r.skipped,
          answeredAt: r.answeredAt.toISOString(),
          advisorNote: note
            ? {
                id: note.id,
                body: note.body,
                updatedAt: note.updatedAt.toISOString(),
              }
            : null,
        };
      }),
    },
    questionsById,
  };
}
