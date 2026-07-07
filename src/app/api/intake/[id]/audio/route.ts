import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { assertClientRoleForMutationApi } from '@/lib/client/require-client-role';
import { isAdvisorHubNavRole } from '@/lib/auth-roles';
import { getIntakeInterview, saveIntakeResponse } from '@/lib/data/intake';
import { getFacilitatedSessionForAdvisor } from '@/lib/facilitated/session-access';
import {
  uploadIntakeAudioFromBuffer,
  deleteIntakeAudioObject,
} from '@/lib/s3/intake-audio-uploads';
import { prisma } from '@/lib/db';
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit/audit-log';
import { assertClientIntakeAnswersEditable } from '@/lib/client/intake-edit-gate';
import {
  isAllowedAudioMime,
  normalizeAudioMimeType,
} from '@/lib/intake/audio-mime';

/** Voice intake responses cap. 25MB is generous for a single answer at typical
 *  webm/opus bitrates (~32 kbps → ~100 minutes). Anything larger is almost
 *  certainly malformed or malicious. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** CUID/UUID-ish allowlist. Rejects path-traversal and shell metacharacters
 *  before the value reaches the filesystem. Question IDs come from our own
 *  question bank — the bank uses cuid()/uuid, both of which fit this regex. */
const QUESTION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const roleDenied = assertClientRoleForMutationApi(session);
    const isAdvisor = isAdvisorHubNavRole(session.user.role);

    const { id: interviewId } = await params;

    // Parse form data early — advisors pass facilitatedSessionId for Epic 5.11.
    const formData = await request.formData();
    const facilitatedSessionId = formData.get('facilitatedSessionId') as string | null;

    let ownerUserId = session.user.id;
    if (roleDenied && isAdvisor && facilitatedSessionId) {
      const facilitated = await getFacilitatedSessionForAdvisor(
        facilitatedSessionId,
        session.user.id,
      );
      if (
        !facilitated ||
        facilitated.interviewId !== interviewId ||
        facilitated.status !== 'INTAKE'
      ) {
        return NextResponse.json(
          { success: false, error: 'Interview not found' },
          { status: 404 },
        );
      }
      ownerUserId = facilitated.clientId;
    } else if (roleDenied) {
      return roleDenied;
    }

    const contentLength = Number.parseInt(
      request.headers.get('content-length') ?? '',
      10
    );
    if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Audio file exceeds 25MB limit' },
        { status: 413 }
      );
    }

    if (!QUESTION_ID_PATTERN.test(interviewId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid interview id' },
        { status: 400 }
      );
    }

    // Verify interview ownership
    const interview = await getIntakeInterview(ownerUserId, interviewId);
    if (!interview) {
      return NextResponse.json(
        { success: false, error: 'Interview not found' },
        { status: 404 }
      );
    }

    if (ownerUserId === session.user.id) {
      if (interview.status === 'SUBMITTED') {
        return NextResponse.json(
          { success: false, error: 'Intake already submitted.' },
          { status: 409 },
        );
      }
      const editable = await assertClientIntakeAnswersEditable(ownerUserId);
      if (!editable.ok) {
        return NextResponse.json(
          { success: false, error: editable.error },
          { status: 409 },
        );
      }
    }

    // Parse form data
    const audioBlob = formData.get('audio') as Blob;
    const questionId = formData.get('questionId') as string;

    if (!audioBlob || !questionId) {
      return NextResponse.json(
        { success: false, error: 'Missing audio file or questionId' },
        { status: 400 }
      );
    }

    // Reject path-traversal / shell-metacharacter `questionId` values
    // before the value reaches the filename. Without this, a payload of
    // `questionId=../../foo` would write outside the upload dir.
    if (!QUESTION_ID_PATTERN.test(questionId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid questionId' },
        { status: 400 }
      );
    }

    // MIME allowlist on the blob's reported type (parameterized types like
    // `audio/webm;codecs=opus` are normalized before checking).
    const contentType = normalizeAudioMimeType(audioBlob.type);
    if (!isAllowedAudioMime(audioBlob.type)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported audio type' },
        { status: 415 }
      );
    }

    // Post-decode size check. Catches the case where Content-Length is
    // missing or inaccurate (chunked transfer encoding, gzip, etc.).
    if (audioBlob.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { success: false, error: 'Audio file exceeds 25MB limit' },
        { status: 413 }
      );
    }

    // Capture the prior S3 key so we can clean it up after the new object
    // persists. If the user re-records the same question, the old object
    // would otherwise stay in the bucket forever.
    const priorResponse = await prisma.intakeResponse.findUnique({
      where: {
        interviewId_questionId: { interviewId, questionId },
      },
      select: { audioS3Key: true },
    });

    // Upload bytes to S3. The helper handles partial-upload cleanup on its
    // own; we treat a thrown error here as upload failure (no DB write).
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const upload = await uploadIntakeAudioFromBuffer(
      interviewId,
      questionId,
      contentType,
      buffer
    );

    // `audioUrl` is the client-facing playback URL (authenticated streaming
    // route), NOT the raw S3 URL. Bytes are accessed via the streaming
    // route's session+assignment check; the URL itself is harmless to leak.
    const audioUrl = `/api/intake/${interviewId}/audio/${questionId}`;

    // Persist after the S3 write succeeds. If this fails, attempt to clean
    // up the just-uploaded object so we don't leave orphans.
    let response;
    try {
      response = await saveIntakeResponse(interviewId, questionId, {
        audioUrl,
        audioS3Key: upload.s3Key,
        audioContentType: upload.contentType,
        audioDuration: undefined, // Can be calculated client-side if needed
        transcriptionStatus: 'PENDING',
      });
    } catch (dbError) {
      try {
        await deleteIntakeAudioObject(upload.s3Key);
      } catch (cleanupError) {
        console.error(
          'Failed to clean up S3 object after DB write error:',
          cleanupError
        );
      }
      throw dbError;
    }

    // Now that the new object is referenced by the row, retire the old
    // object. Best-effort: a delete failure here just leaves an orphan,
    // which a future GC pass can sweep.
    if (priorResponse?.audioS3Key && priorResponse.audioS3Key !== upload.s3Key) {
      try {
        await deleteIntakeAudioObject(priorResponse.audioS3Key);
      } catch (cleanupError) {
        console.error(
          'Failed to delete superseded intake audio object:',
          cleanupError
        );
      }
    }

    // Audit AFTER the upload + DB write succeed. Per the design's PII rules:
    // ONLY {questionId, contentType, sizeBytes} are recorded. NOT the audio
    // bytes (obvious), NOT the S3 key (changes on re-upload, reveals storage
    // path), NOT the audio URL (same reasoning).
    await writeAudit({
      actor: {
        userId: session.user.id,
        role: session.user.role as UserRole | undefined,
        email: session.user.email,
      },
      action: AUDIT_ACTIONS.INTAKE_AUDIO_UPLOAD,
      entityType: 'IntakeResponse',
      entityId: response.id,
      metadata: {
        interviewId,
        questionId,
        contentType: upload.contentType,
        sizeBytes: upload.size,
        replacedPriorRecording: Boolean(priorResponse?.audioS3Key),
        ...(facilitatedSessionId
          ? { facilitatedSessionId, clientId: ownerUserId }
          : {}),
      },
      request,
    });

    return NextResponse.json({
      success: true,
      audioUrl,
      responseId: response.id,
    });

  } catch (error) {
    console.error('Audio upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload audio file' },
      { status: 500 }
    );
  }
}