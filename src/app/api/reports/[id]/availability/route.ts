import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/reports/[id]/availability
 * Whether a published report exists for the assessment (id = assessmentId).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: assessmentId } = await params;

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { userId: true },
    });

    if (!assessment || assessment.userId !== session.user.id) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const published = await prisma.report.findFirst({
      where: { assessmentId, status: "PUBLISHED" },
      select: { id: true, version: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
    });

    return NextResponse.json({
      hasPublished: published != null,
      publishedReportId: published?.id ?? null,
      version: published?.version ?? null,
    });
  } catch (error) {
    console.error("report availability GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
