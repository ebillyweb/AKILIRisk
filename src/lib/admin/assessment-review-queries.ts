import "server-only";

import type { UserRole } from "@prisma/client";

import { requireAdminRole } from "@/lib/admin/auth";
import { loadGovernanceQuestionsMerged } from "@/lib/assessment/bank/load-bank";
import type { Question } from "@/lib/assessment/types";
import { decryptUserEmail } from "@/lib/auth/user-email-crypto";
import { safeDecryptAnswer } from "@/lib/data/response-content";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export type AssessmentResponseAdminNoteView = {
  id: string;
  body: string;
  updatedAt: string;
};

export type AdminAssessmentReviewRow = {
  responseId: string;
  questionId: string;
  pillar: string;
  subCategory: string;
  answer: unknown;
  skipped: boolean;
  answeredAt: string;
  adminNote: AssessmentResponseAdminNoteView | null;
};

export type AdminAssessmentReviewPayload = {
  assessment: {
    id: string;
    status: string;
    version: number;
    completedAt: Date | null;
    user: { id: string; name: string | null; email: string };
    responses: AdminAssessmentReviewRow[];
  };
  questionsById: Record<string, Question>;
};

export async function getAssessmentForAdminReview(
  assessmentId: string
): Promise<AdminAssessmentReviewPayload | null> {
  const { userId, email, role } = await requireAdminRole();

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
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
          adminNote: {
            select: { id: true, body: true, updatedAt: true },
          },
        },
      },
    },
  });

  if (!assessment) return null;

  void writeAudit({
    actor: { userId, role: role as UserRole, email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ADMIN_ASSESSMENT_REVIEW,
    entityType: "Assessment",
    entityId: assessmentId,
    metadata: {
      responseCount: assessment.responses.length,
      clientUserId: assessment.user.id,
    },
  });

  const allQuestions = await loadGovernanceQuestionsMerged({ onlyVisible: true });
  const questionsById = Object.fromEntries(allQuestions.map((q) => [q.id, q]));

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
      responses: assessment.responses.map((r) => ({
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
        adminNote: r.adminNote
          ? {
              id: r.adminNote.id,
              body: r.adminNote.body,
              updatedAt: r.adminNote.updatedAt.toISOString(),
            }
          : null,
      })),
    },
    questionsById,
  };
}
