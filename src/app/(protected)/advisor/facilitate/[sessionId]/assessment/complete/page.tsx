import { auth } from "@/lib/auth";
import { FacilitatedAssessmentComplete } from "@/components/advisor/facilitate/FacilitatedAssessmentComplete";
import { assertFacilitatedSessionStep } from "@/lib/facilitated/session-layout";

export default async function FacilitatedAssessmentCompletePage({
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

  return (
    <FacilitatedAssessmentComplete
      sessionId={sessionId}
      assessmentId={facilitated.assessmentId}
    />
  );
}
