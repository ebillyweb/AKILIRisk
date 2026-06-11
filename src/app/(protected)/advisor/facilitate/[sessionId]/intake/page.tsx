import { auth } from "@/lib/auth";
import { FacilitatedIntakeWizard } from "@/components/advisor/facilitate/FacilitatedIntakeWizard";
import { assertFacilitatedSessionStep } from "@/lib/facilitated/session-layout";

export default async function FacilitatedIntakePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  const facilitated = await assertFacilitatedSessionStep(sessionId, session!.user!.id, [
    "INTAKE",
  ]);

  if (!facilitated.interviewId) {
    throw new Error("Interview not linked to session");
  }

  return (
    <FacilitatedIntakeWizard sessionId={sessionId} interviewId={facilitated.interviewId} />
  );
}
