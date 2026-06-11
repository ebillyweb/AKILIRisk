import { notFound, redirect } from "next/navigation";

import { FacilitatedSessionBannerFromPath } from "@/components/advisor/facilitate/FacilitatedSessionBannerFromPath";
import { FacilitatedSessionProvider } from "@/components/advisor/facilitate/FacilitatedSessionContext";
import { AssessmentQuestionBankLoader } from "@/components/assessment/AssessmentQuestionBankLoader";
import { auth } from "@/lib/auth";
import { getFacilitatedSessionForAdvisor } from "@/lib/facilitated/session-access";

export default async function FacilitatedSessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const facilitated = await getFacilitatedSessionForAdvisor(sessionId, session.user.id);
  if (!facilitated) notFound();

  if (facilitated.status === "COMPLETE") {
    redirect("/advisor/pipeline");
  }

  return (
    <FacilitatedSessionProvider
      value={{
        sessionId,
        clientName: facilitated.client.name,
        assessmentId: facilitated.assessmentId,
      }}
    >
      <AssessmentQuestionBankLoader />
      <FacilitatedSessionBannerFromPath clientName={facilitated.client.name} />
      {children}
    </FacilitatedSessionProvider>
  );
}
