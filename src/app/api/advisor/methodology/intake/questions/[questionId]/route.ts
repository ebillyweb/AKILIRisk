import { NextResponse } from "next/server";
import { requireAdvisorRole, isAdvisorAuthError, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/advisor/methodology/intake/questions/[questionId]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const { questionId } = await params;
    const body = await request.json();

    const existing = await prisma.advisorIntakeQuestion.findFirst({
      where: { id: questionId, advisorProfileId: profile.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const row = await prisma.advisorIntakeQuestion.update({
      where: { id: questionId },
      data: {
        ...(body.questionText !== undefined ? { questionText: body.questionText } : {}),
        ...(body.context !== undefined ? { context: body.context } : {}),
        ...(body.helpText !== undefined ? { helpText: body.helpText } : {}),
        ...(body.learnMore !== undefined ? { learnMore: body.learnMore } : {}),
        ...(body.isVisible !== undefined ? { isVisible: body.isVisible } : {}),
        ...(body.displayOrder !== undefined ? { displayOrder: body.displayOrder } : {}),
        version: { increment: 1 },
      },
    });

    return NextResponse.json({ question: row });
  } catch (e) {
    if (isAdvisorAuthError(e)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("methodology intake question PATCH", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
