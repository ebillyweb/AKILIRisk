import "server-only";

import {
  type IntakeInterview,
  type IntakeResponse,
  type IntakeStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";

type IntakeResponseInput = {
  audioUrl?: string;
  /** S3 object key for the actual audio bytes. The `audioUrl` is the
   *  client-facing URL of the authenticated streaming route; this is the
   *  byte source the streaming + transcribe routes pass to S3. */
  audioS3Key?: string;
  audioContentType?: string;
  audioDuration?: number;
  transcription?: string;
  transcriptionStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
};

export async function createIntakeInterview(userId: string): Promise<IntakeInterview> {
  return prisma.intakeInterview.create({
    data: {
      userId,
      status: 'NOT_STARTED',
      currentQuestionIndex: 0,
    },
  });
}

export async function getIntakeInterview(userId: string, id: string): Promise<(IntakeInterview & { responses: IntakeResponse[] }) | null> {
  return prisma.intakeInterview.findFirst({
    where: { id, userId },
    include: {
      responses: {
        orderBy: { updatedAt: 'asc' },
      },
    },
  });
}

export async function getActiveIntakeInterview(userId: string): Promise<IntakeInterview | null> {
  return prisma.intakeInterview.findFirst({
    where: {
      userId,
      status: {
        not: 'SUBMITTED'
      }
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/** Most recently touched interview (any status), e.g. to detect SUBMITTED after active filter excludes it. */
export async function getLatestIntakeInterview(userId: string): Promise<IntakeInterview | null> {
  return prisma.intakeInterview.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function saveIntakeResponse(interviewId: string, questionId: string, data: IntakeResponseInput): Promise<IntakeResponse> {
  const hasAudio = Boolean(data.audioUrl);
  const trimmedTranscription =
    data.transcription === undefined ? '' : data.transcription.trim();
  const isTextOnlyAnswer = !hasAudio && trimmedTranscription.length > 0;

  const resolvedCreateStatus =
    data.transcriptionStatus ??
    (isTextOnlyAnswer ? 'COMPLETED' : 'PENDING');

  const transcriptionForCreate =
    data.transcription === undefined
      ? null
      : trimmedTranscription.length > 0
        ? trimmedTranscription
        : null;

  // Round-11 commit 2.5a (BRD §5.1) — bridge-write: keep
  // `hasTranscription` in sync with the plaintext value at every save
  // site. Commit 2.5b's read sites switch from
  // `WHERE transcription != ""` to `WHERE hasTranscription = true`,
  // so this denormalized boolean has to be authoritative starting NOW
  // — even before the column flips to ciphertext.
  const transcriptionForUpdate =
    data.transcription === undefined
      ? undefined
      : trimmedTranscription.length > 0
        ? trimmedTranscription
        : null;
  const hasTranscriptionForUpdate =
    data.transcription === undefined
      ? undefined
      : trimmedTranscription.length > 0;

  return prisma.intakeResponse.upsert({
    where: {
      interviewId_questionId: {
        interviewId,
        questionId,
      },
    },
    create: {
      interviewId,
      questionId,
      audioUrl: data.audioUrl ?? null,
      audioS3Key: data.audioS3Key ?? null,
      audioContentType: data.audioContentType ?? null,
      audioDuration: data.audioDuration ?? null,
      transcription: transcriptionForCreate,
      hasTranscription: transcriptionForCreate !== null,
      transcriptionStatus: resolvedCreateStatus,
      answeredAt: isTextOnlyAnswer ? new Date() : null,
    },
    update: {
      audioUrl: data.audioUrl ?? undefined,
      audioS3Key: data.audioS3Key ?? undefined,
      audioContentType: data.audioContentType ?? undefined,
      audioDuration: data.audioDuration ?? undefined,
      transcription: transcriptionForUpdate,
      hasTranscription: hasTranscriptionForUpdate,
      transcriptionStatus: isTextOnlyAnswer
        ? 'COMPLETED'
        : (data.transcriptionStatus ?? undefined),
      ...(isTextOnlyAnswer ? { answeredAt: new Date() } : {}),
    },
  });
}

export async function updateInterviewProgress(
  interviewId: string,
  currentQuestionIndex: number,
  status?: IntakeStatus
): Promise<IntakeInterview | null> {
  const updateData: Prisma.IntakeInterviewUpdateInput = {
    currentQuestionIndex,
    updatedAt: new Date(),
    ...(status ? { status } : {}),
  };

  return prisma.intakeInterview.update({
    where: { id: interviewId },
    data: updateData,
  });
}

export async function submitIntakeInterview(interviewId: string): Promise<IntakeInterview | null> {
  return prisma.intakeInterview.update({
    where: { id: interviewId },
    data: {
      status: 'SUBMITTED',
      submittedAt: new Date(),
    },
  });
}

export async function getIntakeResponsesByInterview(interviewId: string): Promise<IntakeResponse[]> {
  return prisma.intakeResponse.findMany({
    where: { interviewId },
    orderBy: { updatedAt: 'asc' },
  });
}