import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { facilitatedSessionStepPath } from "@/lib/facilitated/types";
import { getFacilitatedSessionForAdvisor } from "@/lib/facilitated/session-access";

export default async function FacilitatedSessionIndexPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const facilitated = await getFacilitatedSessionForAdvisor(sessionId, session.user.id);
  if (!facilitated) redirect("/advisor/facilitate");

  redirect(facilitatedSessionStepPath(sessionId, facilitated.status));
}
