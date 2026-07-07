import { NextRequest, NextResponse } from "next/server";
import { resolveUser } from "@/lib/mobile/token";
import { createIntakeInterview, getActiveIntakeInterview } from "@/lib/data/intake";
import { getMobileIntakeQuestions } from "@/lib/mobile/intake-script";

/**
 * GET /api/intake/script — returns the question set + the user's interview,
 * creating an interview if none is active (plan §4.2).
 */
export async function GET(request: NextRequest) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let interview = await getActiveIntakeInterview(user.id);
  if (!interview) {
    interview = await createIntakeInterview(user.id);
  }

  return NextResponse.json({
    interviewId: interview.id,
    status: interview.status,
    questions: getMobileIntakeQuestions(),
  });
}
