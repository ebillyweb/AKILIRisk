import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FacilitatedAssessmentHub } from "@/components/advisor/facilitate/FacilitatedAssessmentHub";
import { resolveIncludedPillars } from "@/lib/assessment/included-pillars";
import { assertFacilitatedSessionStep } from "@/lib/facilitated/session-layout";

export default async function FacilitatedAssessmentHubPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  const facilitated = await assertFacilitatedSessionStep(sessionId, session!.user!.id, [
    "ASSESSMENT",
    "PREVIEW",
  ]);

  if (!facilitated.assessmentId) {
    throw new Error("Assessment not linked to session");
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: facilitated.assessmentId },
    select: { includedPillars: true },
  });

  const includedPillars = resolveIncludedPillars(assessment?.includedPillars ?? []);

  return (
    <FacilitatedAssessmentHub
      sessionId={sessionId}
      assessmentId={facilitated.assessmentId}
      includedPillars={includedPillars}
    />
  );
}
