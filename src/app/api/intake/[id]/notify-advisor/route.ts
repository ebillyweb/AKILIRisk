import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notifyAdvisorsOfIntake } from "@/lib/intake/notify-advisor";
import { NextRequest, NextResponse } from "next/server";

/**
 * Trigger the assigned-advisor notification flow for a completed intake.
 *
 * Authorization: only the intake's owning client may call this. The
 * previous shape required "any authenticated user" and let any signed-in
 * caller spam advisor notifications by submitting another client's
 * `interviewId`. We now look up the interview, verify the session
 * belongs to its owner, and only then run the notification helper.
 *
 * In normal flow this is invoked from the client's
 * `submitIntakeInterviewAction` server action via direct call (no
 * round-trip through this endpoint). The route is kept for compatibility
 * with any out-of-band caller, but the auth shape is identical to what
 * the action would do.
 */
export async function POST(
  _request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: interviewId } = await props.params;
    if (!interviewId) {
      return NextResponse.json(
        { error: "Interview ID required" },
        { status: 400 }
      );
    }

    // Ownership check. We deliberately use a single 404 for both
    // "no such interview" and "exists but not yours" so a probing client
    // can't enumerate other users' interview ids.
    const interview = await prisma.intakeInterview.findUnique({
      where: { id: interviewId },
      select: { userId: true },
    });
    if (!interview || interview.userId !== session.user.id) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const { notifiedCount } = await notifyAdvisorsOfIntake(interviewId);
    return NextResponse.json({ success: true, notifiedCount });
  } catch (error) {
    console.error("Failed to process advisor notifications:", error);
    return NextResponse.json(
      { error: "Failed to process notifications" },
      { status: 500 }
    );
  }
}
