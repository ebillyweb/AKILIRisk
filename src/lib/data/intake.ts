import "server-only";

import {
  type IntakeInterview,
  type IntakeResponse,
  type IntakeStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  decryptTranscription,
  encryptTranscription,
  safeDecryptTranscription,
} from "@/lib/data/response-content";

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
  skipped?: boolean;
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
  // Round-11 bug-hunt fix (commit B / RISK 2): decrypt transcription
  // at the query-layer exit so consumers (intake interview page,
  // intake-actions wrappers) keep reading row.transcription as
  // plaintext. Without this, the client-form's typed-answer
  // textarea was being prefilled with ciphertext post-2.5b.
  const interview = await prisma.intakeInterview.findFirst({
    where: { id, userId },
    include: {
      responses: {
        orderBy: { updatedAt: 'asc' },
      },
    },
  });
  if (!interview) return null;
  return {
    ...interview,
    responses: interview.responses.map((r) => ({
      ...r,
      // Round-11 cleanup: tamper-resilient decrypt — corrupted rows
      // surface as null transcription instead of crashing the page.
      transcription: safeDecryptTranscription(r.transcription, {
        rowId: r.id,
        column: "IntakeResponse.transcription",
      }),
    })),
  };
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
  const isSkipped = data.skipped === true;
  const trimmedTranscription =
    data.transcription === undefined ? '' : data.transcription.trim();
  const isTextOnlyAnswer = !hasAudio && !isSkipped && trimmedTranscription.length > 0;

  const resolvedCreateStatus =
    data.transcriptionStatus ??
    (isSkipped || isTextOnlyAnswer ? 'COMPLETED' : 'PENDING');

  const transcriptionForCreate =
    isSkipped
      ? null
      : data.transcription === undefined
        ? null
        : trimmedTranscription.length > 0
          ? trimmedTranscription
          : null;

  // Round-11 commit 2.5b (BRD §5.1): encrypt transcription before
  // writing. The `transcription` column now stores ciphertext; the
  // denormalized `hasTranscription` boolean is the only column the
  // pipeline filters can index on. Plaintext is never persisted.
  const transcriptionCiphertextForCreate =
    transcriptionForCreate === null ? null : encryptTranscription(transcriptionForCreate);
  const transcriptionForUpdate =
    isSkipped
      ? null
      : data.transcription === undefined
        ? undefined
        : trimmedTranscription.length > 0
          ? encryptTranscription(trimmedTranscription)
          : null;
  const hasTranscriptionForUpdate =
    isSkipped
      ? false
      : data.transcription === undefined
        ? undefined
        : trimmedTranscription.length > 0;

  const created = await prisma.intakeResponse.upsert({
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
      transcription: transcriptionCiphertextForCreate,
      hasTranscription: transcriptionCiphertextForCreate !== null,
      transcriptionStatus: resolvedCreateStatus,
      skipped: isSkipped,
      answeredAt: isSkipped || isTextOnlyAnswer ? new Date() : null,
    },
    update: {
      audioUrl: data.audioUrl ?? undefined,
      audioS3Key: data.audioS3Key ?? undefined,
      audioContentType: data.audioContentType ?? undefined,
      audioDuration: data.audioDuration ?? undefined,
      transcription: transcriptionForUpdate,
      hasTranscription: hasTranscriptionForUpdate,
      transcriptionStatus: isSkipped
        ? 'COMPLETED'
        : isTextOnlyAnswer
          ? 'COMPLETED'
          : (data.transcriptionStatus ?? undefined),
      skipped: isSkipped,
      ...(isSkipped || isTextOnlyAnswer ? { answeredAt: new Date() } : {}),
    },
  });

  // Decrypt before returning so callers continue to see plaintext.
  return {
    ...created,
    transcription: created.transcription
      ? decryptTranscription(created.transcription)
      : null,
  };
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
  // Round-11 commit 2.5b: decrypt transcription at the query layer
  // so callers (advisor review screens, intake interview page) keep
  // reading row.transcription as plaintext.
  // Round-11 cleanup: tamper-resilient decrypt.
  const rows = await prisma.intakeResponse.findMany({
    where: { interviewId },
    orderBy: { updatedAt: 'asc' },
  });
  return rows.map((r) => ({
    ...r,
    transcription: safeDecryptTranscription(r.transcription, {
      rowId: r.id,
      column: "IntakeResponse.transcription",
    }),
  }));
}