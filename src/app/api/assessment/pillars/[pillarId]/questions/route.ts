import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadPillarQuestions } from "@/lib/assessment/pillar-config";
import { isAssessmentPillarId, normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { wireQuestionsToQuestions } from "@/lib/assessment/bank/behaviors";
import type { GovernanceQuestionWire } from "@/lib/assessment/bank/behaviors";
import { loadGovernanceQuestionWires } from "@/lib/assessment/bank/load-bank";
import { authorizeAssessmentApiAccess } from "@/lib/facilitated/assessment-access";
import { loadSnapshotForAssessment } from "@/lib/methodology/snapshot";
import { pillarQuestionsFromSnapshot } from "@/lib/methodology/assessment-from-snapshot";
import { getPlatformPillarCatalog } from "@/lib/methodology/cached-pillar-catalog";

/**
 * GET /api/assessment/pillars/[pillarId]/questions
 * Visible questions for one assessment pillar (snapshot-pinned when in progress).
 * Advisors facilitating a session must pass `facilitatedSessionId` + `assessmentId`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ pillarId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { pillarId } = await params;
    const normalized = normalizePillarSlug(pillarId);
    const catalog = await getPlatformPillarCatalog();

    if (!isAssessmentPillarId(normalized, catalog)) {
      return NextResponse.json({ error: "Unknown pillar" }, { status: 400 });
    }

    const searchParams = new URL(request.url).searchParams;
    const facilitatedSessionId = searchParams.get("facilitatedSessionId");
    const assessmentIdParam = searchParams.get("assessmentId");

    let assessmentId: string | null = null;

    if (facilitatedSessionId && assessmentIdParam) {
      const access = await authorizeAssessmentApiAccess({
        assessmentId: assessmentIdParam,
        userId: session.user.id,
        userRole: session.user.role,
        facilitatedSessionId,
      });
      if (!access) {
        return NextResponse.json({ error: "Assessment not found" }, { status: 404 });
      }
      assessmentId = assessmentIdParam;
    } else {
      const inProgress = await prisma.assessment.findFirst({
        where: { userId: session.user.id, status: "IN_PROGRESS" },
        orderBy: { updatedAt: "desc" },
        select: { id: true },
      });
      assessmentId = inProgress?.id ?? null;
    }

    if (assessmentId) {
      const snapshot = await loadSnapshotForAssessment(assessmentId);
      if (snapshot) {
        const questions = pillarQuestionsFromSnapshot(snapshot, normalized);
        if (questions.length > 0) {
          return NextResponse.json({ pillarId: normalized, questions, source: "snapshot" });
        }
      }
    }

    const wires: GovernanceQuestionWire[] = await loadGovernanceQuestionWires({
      onlyVisible: true,
      riskAreaId: normalized,
    });

    const questions =
      wires.length > 0
        ? wireQuestionsToQuestions(wires)
        : await loadPillarQuestions(normalized);

    return NextResponse.json({ pillarId: normalized, questions });
  } catch (e) {
    console.error("pillar questions GET", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
