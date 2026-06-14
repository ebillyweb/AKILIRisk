import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveUser } from "@/lib/mobile/token";
import { submitIntakeInterview } from "@/lib/data/intake";

const schema = z.object({ interviewId: z.string().min(1) });

/** POST /api/intake/submit — finalizes the intake once answers are synced. */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "interviewId is required." }, { status: 400 });
  }

  const interview = await prisma.intakeInterview.findFirst({
    where: { id: parsed.data.interviewId, userId: user.id },
    select: { id: true },
  });
  if (!interview) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  await submitIntakeInterview(interview.id);
  return NextResponse.json({ referenceId: interview.id });
}
