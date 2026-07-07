import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isClientActionPlanEnabledForUser } from "@/lib/client/client-action-plan-visibility.server";
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

  const [access, actionPlanEnabled] = await Promise.all([
    getClientAssessmentSummaryAccess(session.user.id),
    isClientActionPlanEnabledForUser(session.user.id),
  ]);

  return NextResponse.json({ ...access, actionPlanEnabled });
}
