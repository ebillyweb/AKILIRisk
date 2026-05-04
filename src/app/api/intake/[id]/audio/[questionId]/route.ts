import { NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getIntakeAudioObjectBytes } from "@/lib/s3/intake-audio-uploads";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { shouldAuditAudioStream } from "@/lib/audit/audio-stream-dedupe";

/** Same allowlist as the upload route. Reject path-traversal / shell
 *  metacharacters before any DB lookup. */
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Authenticated streaming proxy for intake voice responses.
 *
 * Replaces the old `public/uploads/intake/...` static path that exposed
 * intake audio to anyone who guessed the URL. Bytes are stored in S3
 * (private), never served from the bucket directly. Every fetch passes
 * through this handler's auth + assignment check.
 *
 * Authorized callers:
 *   - The intake's own client (interview.userId === session.user.id), OR
 *   - An ADVISOR/ADMIN with an ACTIVE ClientAdvisorAssignment to that client.
 *
 * Returns 404 (not 403) on auth failure so we don't leak which interview
 * IDs / question IDs exist — same posture as the admin advisor-logo route.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; questionId: string }> }
) {
  const { id: interviewId, questionId } = await context.params;

  if (!ID_PATTERN.test(interviewId) || !ID_PATTERN.test(questionId)) {
    return new NextResponse(null, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const response = await prisma.intakeResponse.findUnique({
    where: {
      interviewId_questionId: { interviewId, questionId },
    },
    select: {
      // id selected so the audit row's entityId points at the response
      // without an extra round-trip.
      id: true,
      audioS3Key: true,
      audioContentType: true,
      interview: {
        select: { userId: true },
      },
    },
  });

  if (!response?.audioS3Key) {
    return new NextResponse(null, { status: 404 });
  }

  const ownerUserId = response.interview.userId;
  const isOwner = ownerUserId === session.user.id;

  let isAssignedAdvisor = false;
  if (!isOwner) {
    const role = session.user.role?.toString().toUpperCase();
    if (role === "ADVISOR" || role === "ADMIN") {
      const advisor = await prisma.advisorProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (advisor) {
        const assignment = await prisma.clientAdvisorAssignment.findFirst({
          where: {
            advisorId: advisor.id,
            clientId: ownerUserId,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        isAssignedAdvisor = Boolean(assignment);
      }
    }
  }

  if (!isOwner && !isAssignedAdvisor) {
    return new NextResponse(null, { status: 404 });
  }

  let bytes;
  try {
    bytes = await getIntakeAudioObjectBytes(response.audioS3Key);
  } catch (e) {
    console.error("Intake audio fetch error:", e);
    return new NextResponse(null, { status: 500 });
  }

  // Audit the access — but only on the 200 success path, and subject to the
  // 5-minute dedupe so HTML <audio> range requests don't produce N rows per
  // playback. 401 and 404 paths intentionally do NOT audit:
  //   - 401: actor unknown.
  //   - 404: route returns 404 to avoid existence leaks; auditing would
  //     create the same leak inside the audit log.
  // Audit metadata is intentionally narrow — interviewId, questionId, role —
  // never the bytes, never the S3 key, never the audio URL.
  if (
    shouldAuditAudioStream(session.user.id, interviewId, questionId)
  ) {
    void writeAudit({
      actor: {
        userId: session.user.id,
        role: session.user.role as UserRole | undefined,
        email: session.user.email,
      },
      action: AUDIT_ACTIONS.DATA_ACCESS_AUDIO_STREAM,
      entityType: "IntakeResponse",
      entityId: response.id,
      metadata: {
        interviewId,
        questionId,
        accessRole: isOwner ? "owner" : "assigned_advisor",
      },
    });
  }

  return new NextResponse(Buffer.from(bytes.data), {
    headers: {
      "Content-Type": response.audioContentType ?? bytes.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
