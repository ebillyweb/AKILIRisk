import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const assessment = await prisma.assessment.findUnique({
      where: {
        id,
      },
      include: {
        responses: {
          select: {
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

    // Verify ownership. Return 404 (not 403) so a probing client can't
    // tell "no such assessment" from "exists but not yours" — assessment
    // ids are CUIDs, but defense-in-depth on the ownership boundary is
    // free here.
    if (assessment.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Assessment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(assessment);
  } catch (error) {
    console.error("Error fetching assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
