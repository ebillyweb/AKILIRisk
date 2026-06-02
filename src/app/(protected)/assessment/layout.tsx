import { auth } from "@/lib/auth";
import { getClientIntakeGateState } from "@/lib/client/intake-gate";
import { redirectPathUnlessClientRole } from "@/lib/client/require-client-role";
import { redirect } from "next/navigation";

/**
 * Client assessment flow is USER-only. Staff use advisor/admin workspaces.
 * For clients: only allow access when intake is submitted and approved,
 * or the assigned advisor has waived the intake requirement.
 */
export default async function AssessmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) return <>{children}</>;

  const staffRedirect = redirectPathUnlessClientRole(session.user.role);
  if (staffRedirect) redirect(staffRedirect);

  const gate = await getClientIntakeGateState(session.user.id);
  if (!gate.assessmentUnlocked) {
    if (!gate.hasSubmittedInterview) {
      redirect("/dashboard?assessment=complete-intake");
    }
    redirect("/dashboard?assessment=awaiting-approval");
  }

  return <>{children}</>;
}
