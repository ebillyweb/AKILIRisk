import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@prisma/client';
import { auth } from '@/lib/auth';
import { getIntakeInterview, saveIntakeResponse } from '@/lib/data/intake';
import {
  uploadIntakeAudioFromBuffer,
  deleteIntakeAudioObject,
} from '@/lib/s3/intake-audio-uploads';
import { prisma } from '@/lib/db';
import { writeAudit, AUDIT_ACTIONS } from '@/lib/audit/audit-log';

/** Voice intake responses cap. 25MB is generous for a single answer at typical
 *  webm/opus bitrates (~32 kbps → ~100 minutes). Anything larger is almost
 *  certainly malformed or malicious. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** CUID/UUID-ish allowlist. Rejects path-traversal and shell metacharacters
 *  before the value reaches the filesystem. Question IDs come from our own
 *  question bank — the bank uses cuid()/uuid, both of which fit this regex. */
const QUESTION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** Audio container types we accept. Browsers' MediaRecorder typically emits
 *  webm/opus on Chromium and mp4/aac on Safari; we accept the common siblings
 *  too. The blob's reported `type` is a soft check (clients can lie) — the
 *  fixed `.webm` filename means files saved here are never interpreted by the
 *  filesystem as something else. */
const ALLOWED_AUDIO_MIMES = new Set<string>([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
]);

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

    // Reject oversized uploads before reading the body. We can't reliably
    // bail mid-read inside the Next.js formData parser, so the
    // Content-Length precheck is our primary cap; the post-decode size
    // check below catches a chunked-encoding bypass.
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

    const userId = session.user.id;
    const { id: interviewId } = await params;

    // Defense in depth: even though `interviewId` is checked for ownership
    // below, reject malformed values before they touch any filesystem path.
    if (!QUESTION_ID_PATTERN.test(interviewId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid interview id' },
        { status: 400 }
      );
    }

    // Verify interview ownership
    const interview = await getIntakeInterview(userId, interviewId);
    if (!interview) {
      return NextResponse.json(
        { success: false, error: 'Interview not found' },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await request.formData();
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

    // MIME allowlist on the blob's reported type. Clients can lie about
    // this header, but combined with the fixed `.webm` extension and the
    // strict filename, a wrong type just produces an unplayable file —
    // not a code-execution vector.
    if (!ALLOWED_AUDIO_MIMES.has(audioBlob.type)) {
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
      audioBlob.type,
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
        userId,
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