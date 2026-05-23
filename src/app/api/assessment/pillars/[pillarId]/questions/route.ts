import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadPillarQuestions } from "@/lib/assessment/pillar-config";
import { isAssessmentPillarId, normalizePillarSlug } from "@/lib/assessment/pillar-registry";
import { wireQuestionsToQuestions } from "@/lib/assessment/bank/behaviors";
import type { GovernanceQuestionWire } from "@/lib/assessment/bank/behaviors";
import { loadGovernanceQuestionWires } from "@/lib/assessment/bank/load-bank";

/**
 * GET /api/assessment/pillars/[pillarId]/questions
 * Visible questions for one of the six assessment pillars.
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
