import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientAssessmentScope } from "@/lib/client/assessment-scope";

/**
 * Assessment API Routes
 *
 * GET: List all assessments for the authenticated user
 * POST: Create a new assessment
 */

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const assessments = await prisma.assessment.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
      include: {
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    return NextResponse.json(assessments);
  } catch (error) {
    console.error("Error fetching assessments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const scope = await getClientAssessmentScope(session.user.id);

    if (scope.includedPillars.length === 0) {
      return NextResponse.json(
        { error: "Assessment is not unlocked yet. Your advisor must approve intake and select domains first." },
        { status: 403 },
      );
    }

    const existing = await prisma.assessment.findFirst({
      where: { userId: session.user.id, status: "IN_PROGRESS" },
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      if (existing.includedPillars.length === 0) {
        const updated = await prisma.assessment.update({
          where: { id: existing.id },
          data: {
            approvalId: scope.approvalId,
            includedPillars: scope.includedPillars,
          },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json(existing);
    }

    const assessment = await prisma.assessment.create({
      data: {
        userId: session.user.id,
        version: 1,
        status: "IN_PROGRESS",
        approvalId: scope.approvalId,
        includedPillars: scope.includedPillars,
      },
    });

    return NextResponse.json(assessment, { status: 201 });
  } catch (error) {
    console.error("Error creating assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
