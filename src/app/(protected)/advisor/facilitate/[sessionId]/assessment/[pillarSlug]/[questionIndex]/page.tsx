import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FacilitatedQuestionPage } from "@/components/advisor/facilitate/FacilitatedQuestionView";
import { resolveIncludedPillars } from "@/lib/assessment/included-pillars";
import { assertFacilitatedSessionStep } from "@/lib/facilitated/session-layout";

export default async function FacilitatedQuestionRoutePage({
  params,
}: {
  params: Promise<{
    sessionId: string;
    pillarSlug: string;
    questionIndex: string;
  }>;
}) {
  const resolved = await params;
  const session = await auth();
  const facilitated = await assertFacilitatedSessionStep(
    resolved.sessionId,
    session!.user!.id,
    ["ASSESSMENT", "PREVIEW"],
  );

  if (!facilitated.assessmentId) {
    throw new Error("Assessment not linked to session");
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: facilitated.assessmentId },
    select: { includedPillars: true },
  });

  return (
    <FacilitatedQuestionPage
      params={Promise.resolve(resolved)}
      assessmentId={facilitated.assessmentId}
      includedPillars={resolveIncludedPillars(assessment?.includedPillars ?? [])}
    />
  );
}
