import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePillarScoreId } from "@/lib/assessment/pillar-registry";
import { authorizeAssessmentApiAccess } from "@/lib/facilitated/assessment-access";

/**
 * GET /api/assessment/[id]/pillar-scores
 * All PillarScore rows for an assessment (canonical pillar ids).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const facilitatedSessionId =
      request.nextUrl.searchParams.get("facilitatedSessionId") ?? undefined;

    const access = await authorizeAssessmentApiAccess({
      assessmentId: id,
      userId: session.user.id,
      userRole: session.user.role,
      facilitatedSessionId,
    });
    if (!access) {
      return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
    }

    const rows = await prisma.pillarScore.findMany({
      where: { assessmentId: id },
      select: { pillar: true, score: true, riskLevel: true },
      orderBy: { pillar: "asc" },
    });

    return NextResponse.json(
      rows.map((row) => ({
        pillar: normalizePillarScoreId(row.pillar),
        score: row.score,
        riskLevel: row.riskLevel,
      }))
    );
  } catch (error) {
    console.error("pillar-scores GET", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
