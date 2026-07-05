import { auth } from "@/lib/auth";
import { getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { FacilitatedPillarSelectForm } from "@/components/advisor/facilitate/FacilitatedPillarSelectForm";
import { facilitatedGetPillarSelectContext } from "@/lib/actions/facilitated-pillar-actions";
import { loadAdvisorAssessmentDomainPickerData } from "@/lib/methodology/advisor-assessment-domains";
import { assertFacilitatedSessionStep } from "@/lib/facilitated/session-layout";
import { getFacilitatedSessionForAdvisor } from "@/lib/facilitated/session-access";
import { tryAdvanceFacilitatedPastPostIntakeReview } from "@/lib/facilitated/post-intake-advance";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

export default async function FacilitatedPillarsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  const userId = session!.user!.id;
  await assertFacilitatedSessionStep(sessionId, userId, ["PILLAR_SELECT"]);

  const facilitated = await getFacilitatedSessionForAdvisor(sessionId, userId);
  if (facilitated?.interviewId) {
    const profile = await getAdvisorProfileOrThrow(userId);
    const advancePath = await tryAdvanceFacilitatedPastPostIntakeReview({
      facilitatedSessionId: sessionId,
      clientUserId: facilitated.clientId,
      interviewId: facilitated.interviewId,
      advisorProfileId: profile.id,
      advisorUserId: userId,
      actor: {
        userId,
        role: session!.user!.role as UserRole,
        email: session!.user!.email ?? null,
      },
    });
    if (advancePath) {
      redirect(advancePath);
    }
  }

  const context = await facilitatedGetPillarSelectContext(sessionId);
  if (!context.success) {
    throw new Error(context.error ?? "Failed to load recommendations");
  }

  const profile = await getAdvisorProfileOrThrow(userId);
  const assessmentDomainPicker = await loadAdvisorAssessmentDomainPickerData(profile.id);

  return (
    <FacilitatedPillarSelectForm
      sessionId={sessionId}
      recommendations={context.recommendations}
      assessmentDomainPicker={assessmentDomainPicker}
    />
  );
}
