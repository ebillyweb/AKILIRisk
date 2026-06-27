import "server-only";

import { getIntakeInterview } from "@/lib/data/intake";
import { getAssignedAdvisorFirmNameForClient } from "@/lib/client/assigned-advisor-firm-name";
import { loadIntakeScriptForInterview } from "@/lib/intake/load-intake-script";
import { personalizeIntakeScript } from "@/lib/intake/personalize-intake-question";
import { intakeResponsePlaybackUrl } from "@/lib/intake/playback-url";
import type { IntakeQuestion } from "@/lib/intake/types";
import { prisma } from "@/lib/db";
import { hasClientAssessmentStarted } from "@/lib/client/intake-edit-gate";

export type ClientIntakeReviewResponse = {
  questionId: string;
  audioUrl: string | null;
  audioDuration: number | null;
  transcription: string | null;
  transcriptionStatus: string | null;
  skipped: boolean;
};

export type ClientIntakeReviewPageData = {
  locked: boolean;
  interviewId: string;
  submittedAt: Date | null;
  status: string;
  questions: IntakeQuestion[];
  responses: ClientIntakeReviewResponse[];
};

async function findInterviewIdForClientReview(
  clientUserId: string,
): Promise<string | null> {
  const submitted = await prisma.intakeInterview.findFirst({
    where: { userId: clientUserId, status: "SUBMITTED" },
    orderBy: { submittedAt: "desc" },
    select: { id: true },
  });
  if (submitted) return submitted.id;

  const latest = await prisma.intakeInterview.findFirst({
    where: { userId: clientUserId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return latest?.id ?? null;
}

export async function getClientIntakeReviewPageData(
  clientUserId: string,
): Promise<ClientIntakeReviewPageData | null> {
  const interviewId = await findInterviewIdForClientReview(clientUserId);
  if (!interviewId) return null;

  const [interview, locked, firmName] = await Promise.all([
    getIntakeInterview(clientUserId, interviewId),
    hasClientAssessmentStarted(clientUserId),
    getAssignedAdvisorFirmNameForClient(clientUserId),
  ]);
  if (!interview) return null;

  const script = await loadIntakeScriptForInterview(interviewId);
  const questions = personalizeIntakeScript(script, firmName);

  const responses: ClientIntakeReviewResponse[] = interview.responses.map(
    (row) => ({
      questionId: row.questionId,
      audioUrl: row.audioS3Key
        ? intakeResponsePlaybackUrl(interviewId, row.questionId)
        : row.audioUrl,
      audioDuration: row.audioDuration,
      transcription: row.transcription,
      transcriptionStatus: row.transcriptionStatus,
      skipped: row.skipped,
    }),
  );

  return {
    locked,
    interviewId,
    submittedAt: interview.submittedAt,
    status: interview.status,
    questions,
    responses,
  };
}
