import { auth } from "@/lib/auth";
import { FacilitatedPillarSelectForm } from "@/components/advisor/facilitate/FacilitatedPillarSelectForm";
import { facilitatedGetPillarSelectContext } from "@/lib/actions/facilitated-pillar-actions";
import { loadAdvisorAssessmentDomainOptions } from "@/lib/methodology/advisor-assessment-domains";
import { getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { assertFacilitatedSessionStep } from "@/lib/facilitated/session-layout";

export default async function FacilitatedPillarsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  await assertFacilitatedSessionStep(sessionId, session!.user!.id, ["PILLAR_SELECT"]);

  const context = await facilitatedGetPillarSelectContext(sessionId);
  if (!context.success) {
    throw new Error(context.error ?? "Failed to load recommendations");
  }

  const profile = await getAdvisorProfileOrThrow(session!.user!.id);
  const assessmentDomains = await loadAdvisorAssessmentDomainOptions(profile.id);

  return (
    <FacilitatedPillarSelectForm
      sessionId={sessionId}
      recommendations={context.recommendations}
      assessmentDomains={assessmentDomains}
    />
  );
}
