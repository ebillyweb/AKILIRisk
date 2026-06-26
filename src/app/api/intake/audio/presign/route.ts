import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveUser } from "@/lib/mobile/token";
import { generateUploadUrlForKey } from "@/lib/documents/s3";
import { intakeAudioKey } from "@/lib/intake/audio-key";

const schema = z.object({
  interviewId: z.string().min(1),
  questionId: z.string().min(1).max(128),
});

/** POST /api/intake/audio/presign — presigned S3 PUT for a voice answer. */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "interviewId and questionId are required." }, { status: 400 });
  }
  const { interviewId, questionId } = parsed.data;

  const interview = await prisma.intakeInterview.findFirst({
    where: { id: interviewId, userId: user.id },
    select: { id: true },
  });
  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  // Deterministic key: a retry re-uploads to the same object instead of
  // orphaning a new one (idempotent across crash/resync).
  const key = intakeAudioKey(interviewId, questionId);

  try {
    const { signedUrl } = await generateUploadUrlForKey(key, "audio/m4a");
    return NextResponse.json({ uploadUrl: signedUrl, fileKey: key });
  } catch (error) {
    console.error("intake presign error:", error);
    return NextResponse.json({ error: "Could not prepare upload." }, { status: 500 });
  }
}
