import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientAssessmentSummaryAccess } from "@/lib/client/assessment-summary-gate";

/**
 * GET /api/assessment/summary-access
 * Returns whether the signed-in client may view Assessment Summary.
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const access = await getClientAssessmentSummaryAccess(session.user.id);

  return NextResponse.json(access);
}
