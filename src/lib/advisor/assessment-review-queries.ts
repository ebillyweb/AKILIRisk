import "server-only";

import { requireAdvisorRole } from "@/lib/advisor/auth";
import {
  listAdvisorProfileIdsForScope,
  findPortfolioAssignmentForClient,
  resolvePortfolioScope,
} from "@/lib/enterprise/portfolio-access";
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

/** A note authored by another advisor, shown read-only to firm (enterprise) viewers. */
export type AdvisorAssessmentResponseOtherNoteView = {
  id: string;
  body: string;
  updatedAt: string;
  authorName: string;
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
  /** Notes left by other advisors — populated only for firm-scope (enterprise) viewers. */
  otherAdvisorNotes: AdvisorAssessmentResponseOtherNoteView[];
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
  const scope = await resolvePortfolioScope(userId);
  if (!scope) return null;

  const advisorProfileIds = await listAdvisorProfileIdsForScope(scope);

  // Tenant gate: the assessment's owner must have an ACTIVE assignment within
  // the caller's portfolio scope. Anything else returns null so non-assigned
  // advisors can't probe assessment existence.
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      user: {
        clientAssignments: {
          some: {
            advisorId: { in: advisorProfileIds },
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
            // Firm (enterprise OWNER/ADMIN) viewers see every advisor's note on
            // the answer; a regular advisor sees only their own.
            where: scope.mode === "firm" ? {} : { advisorId: userId },
            select: {
              id: true,
              advisorId: true,
              body: true,
              updatedAt: true,
              advisor: { select: { name: true } },
            },
            orderBy: { updatedAt: "desc" },
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
        const ownNote = r.advisorNotes.find((n) => n.advisorId === userId) ?? null;
        const otherAdvisorNotes = r.advisorNotes
          .filter((n) => n.advisorId !== userId)
          .map((n) => ({
            id: n.id,
            body: n.body,
            updatedAt: n.updatedAt.toISOString(),
            authorName: n.advisor?.name ?? "Advisor",
          }));
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
          advisorNote: ownNote
            ? {
                id: ownNote.id,
                body: ownNote.body,
                updatedAt: ownNote.updatedAt.toISOString(),
              }
            : null,
          otherAdvisorNotes,
        };
      }),
    },
    questionsById,
  };
}

/** Read-only assessment loader for PDF export with branding assignment id. */
export async function getAssessmentForAdvisorExport(
  assessmentId: string,
): Promise<
  (AdvisorAssessmentReviewPayload & { assignmentAdvisorProfileId: string }) | null
> {
  const { userId } = await requireAdvisorRole();
  const payload = await getAssessmentForAdvisorReview(assessmentId);
  if (!payload) return null;

  const scope = await resolvePortfolioScope(userId);
  if (!scope) return null;

  const access = await findPortfolioAssignmentForClient(
    scope,
    payload.assessment.user.id,
  );
  if (!access) return null;

  return {
    ...payload,
    assignmentAdvisorProfileId: access.assignmentAdvisorProfileId,
  };
}
