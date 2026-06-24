import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeAssessmentApiAccess } from "@/lib/facilitated/assessment-access";
import { mapAssessmentForRehydration } from "@/lib/assessment/map-assessment-for-rehydration";

/**
 * Single Assessment API Route
 *
 * GET: Fetch a single assessment with all responses (for server rehydration)
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const facilitatedSessionId =
      request.nextUrl.searchParams.get("facilitatedSessionId") ?? undefined;

    const assessment = await prisma.assessment.findUnique({
      where: {
        id,
      },
      include: {
        responses: {
          select: {
            id: true,
            questionId: true,
            answer: true,
            skipped: true,
          },
        },
      },
    });

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    const access = await authorizeAssessmentApiAccess({
      assessmentId: id,
      userId: session.user.id,
      userRole: session.user.role,
      facilitatedSessionId,
    });
    if (!access) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(mapAssessmentForRehydration(assessment));
  } catch (error) {
    console.error("Error fetching assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
