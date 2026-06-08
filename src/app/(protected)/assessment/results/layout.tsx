import { auth } from "@/lib/auth";
import { normalizeUserRoleString } from "@/lib/auth-roles";
import { getClientAssessmentSummaryAccess } from "@/lib/client/assessment-summary-gate";
import { redirect } from "next/navigation";

export default async function AssessmentResultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return children;
  }

  const role = normalizeUserRoleString(session.user.role);
  if (role !== "USER") {
    return children;
  }

  const access = await getClientAssessmentSummaryAccess(session.user.id);
  if (!access.canViewSummary) {
    redirect(access.allPillarsComplete ? "/dashboard" : "/assessment");
  }

  return children;
}
