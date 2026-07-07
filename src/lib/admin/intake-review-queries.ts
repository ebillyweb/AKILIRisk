import "server-only";

import type { UserRole } from "@prisma/client";

import { requireAdminRole } from "@/lib/admin/auth";
import { decryptUserEmail } from "@/lib/auth/user-email-crypto";
import { safeDecryptTranscription } from "@/lib/data/response-content";
import { prisma } from "@/lib/db";
import { loadIntakeScriptForInterview } from "@/lib/intake/load-intake-script";
import { intakeResponsePlaybackUrl } from "@/lib/intake/playback-url";
import { personalizeIntakeScript } from "@/lib/intake/personalize-intake-question";
import { getAssignedAdvisorFirmNameForClient } from "@/lib/client/assigned-advisor-firm-name";
import type { IntakeQuestion } from "@/lib/intake/types";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

export type IntakeResponseAdminNoteView = {
  id: string;
  body: string;
  updatedAt: string;
};

export type AdminIntakeReviewResponse = {
  id: string;
  questionId: string;
  audioUrl: string | null;
  audioDuration: number | null;
  transcription: string | null;
  transcriptionStatus: string;
  adminNote: IntakeResponseAdminNoteView | null;
};

export type AdminIntakeReviewPayload = {
  interview: {
    id: string;
    status: string;
    submittedAt: Date | null;
    user: { id: string; name: string | null; email: string };
    responses: AdminIntakeReviewResponse[];
  };
  questions: IntakeQuestion[];
};

export async function getIntakeInterviewForAdminReview(
  interviewId: string
): Promise<AdminIntakeReviewPayload | null> {
  const { userId, email, role } = await requireAdminRole();

  const interview = await prisma.intakeInterview.findUnique({
    where: { id: interviewId },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      user: { select: { id: true, name: true, emailCiphertext: true } },
      responses: {
        orderBy: { updatedAt: "asc" },
        select: {
          id: true,
          questionId: true,
          audioUrl: true,
          audioS3Key: true,
          audioDuration: true,
          transcription: true,
          transcriptionStatus: true,
          adminNote: {
            select: { id: true, body: true, updatedAt: true },
          },
        },
      },
    },
  });

  if (!interview) return null;

  void writeAudit({
    actor: { userId, role: role as UserRole, email },
    action: AUDIT_ACTIONS.DATA_ACCESS_ADMIN_INTAKE_REVIEW,
    entityType: "IntakeInterview",
    entityId: interviewId,
    metadata: {
      responseCount: interview.responses.length,
      clientUserId: interview.user.id,
    },
  });

  const [questions, firmName] = await Promise.all([
    loadIntakeScriptForInterview(interviewId),
    getAssignedAdvisorFirmNameForClient(interview.user.id),
  ]);

  return {
    interview: {
      id: interview.id,
      status: interview.status,
      submittedAt: interview.submittedAt,
      user: {
        id: interview.user.id,
        name: interview.user.name,
        email: decryptUserEmail(interview.user.emailCiphertext),
      },
      responses: interview.responses.map((r) => ({
        id: r.id,
        questionId: r.questionId,
        audioUrl: r.audioS3Key
          ? (r.audioUrl ?? intakeResponsePlaybackUrl(interviewId, r.questionId))
          : r.audioUrl,
        audioDuration: r.audioDuration,
        transcription: safeDecryptTranscription(r.transcription, {
          rowId: r.id,
          column: "IntakeResponse.transcription",
        }),
        transcriptionStatus: r.transcriptionStatus,
        adminNote: r.adminNote
          ? {
              id: r.adminNote.id,
              body: r.adminNote.body,
              updatedAt: r.adminNote.updatedAt.toISOString(),
            }
          : null,
      })),
    },
    questions: personalizeIntakeScript(questions, firmName),
  };
}
