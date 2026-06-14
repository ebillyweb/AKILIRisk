import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveUser } from "@/lib/mobile/token";

const schema = z.object({
  interviewId: z.string().min(1),
  questionId: z.string().min(1),
  mode: z.enum(["TYPE", "VOICE"]),
  text: z.string().max(8000).optional(),
  fileKey: z.string().max(512).optional(),
  updatedAt: z.string().optional(),
});

/**
 * POST /api/intake/response — idempotent upsert of a single intake answer
 * (plan §8). Conflict rule: a newer server `updatedAt` wins on first sync.
 */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid response payload." }, { status: 400 });
  }
  const { interviewId, questionId, mode, text, fileKey, updatedAt } = parsed.data;

  if (mode === "TYPE" && !text?.trim()) {
    return NextResponse.json({ error: "Typed answers require text." }, { status: 400 });
  }
  if (mode === "VOICE" && !fileKey) {
    return NextResponse.json({ error: "Voice answers require a fileKey." }, { status: 400 });
  }

  // Tenant isolation: the interview must belong to the caller.
  const interview = await prisma.intakeInterview.findFirst({
    where: { id: interviewId, userId: user.id },
    select: { id: true, status: true },
  });
  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }
  if (interview.status === "SUBMITTED") {
    return NextResponse.json({ error: "Intake already submitted." }, { status: 409 });
  }

  const existing = await prisma.intakeResponse.findUnique({
    where: { interviewId_questionId: { interviewId, questionId } },
    select: { updatedAt: true },
  });

  // Server is source of truth: discard a stale client write.
  if (existing && updatedAt && existing.updatedAt > new Date(updatedAt)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await prisma.intakeResponse.upsert({
    where: { interviewId_questionId: { interviewId, questionId } },
    create: {
      interviewId,
      questionId,
      textResponse: mode === "TYPE" ? text!.trim() : null,
      audioUrl: mode === "VOICE" ? fileKey! : null,
      transcriptionStatus: mode === "VOICE" ? "PENDING" : "COMPLETED",
      answeredAt: new Date(),
    },
    update:
      mode === "TYPE"
        ? { textResponse: text!.trim(), audioUrl: null, transcriptionStatus: "COMPLETED", answeredAt: new Date() }
        : { audioUrl: fileKey!, textResponse: null, transcriptionStatus: "PENDING", answeredAt: new Date() },
  });

  if (interview.status === "NOT_STARTED") {
    await prisma.intakeInterview.update({
      where: { id: interviewId },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
  }

  return NextResponse.json({ ok: true });
}
