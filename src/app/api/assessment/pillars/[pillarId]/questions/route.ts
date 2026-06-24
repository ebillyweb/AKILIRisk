import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadPillarQuestions } from "@/lib/assessment/pillar-config";
import { isAssessmentPillarId, normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { wireQuestionsToQuestions } from "@/lib/assessment/bank/behaviors";
import type { GovernanceQuestionWire } from "@/lib/assessment/bank/behaviors";
import { loadGovernanceQuestionWires } from "@/lib/assessment/bank/load-bank";
import { loadSnapshotForAssessment } from "@/lib/methodology/snapshot";
import { pillarQuestionsFromSnapshot } from "@/lib/methodology/assessment-from-snapshot";

/**
 * GET /api/assessment/pillars/[pillarId]/questions
 * Visible questions for one assessment pillar (snapshot-pinned when in progress).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pillarId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { pillarId } = await params;
    const normalized = normalizePillarSlug(pillarId);

    if (!isAssessmentPillarId(normalized)) {
      return NextResponse.json({ error: "Unknown pillar" }, { status: 400 });
    }

    const inProgress = await prisma.assessment.findFirst({
      where: { userId: session.user.id, status: "IN_PROGRESS" },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });

    if (inProgress) {
      const snapshot = await loadSnapshotForAssessment(inProgress.id);
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
