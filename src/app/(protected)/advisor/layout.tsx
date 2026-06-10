import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { getAdvisorHubAccessForUserId } from "@/lib/advisor/auth";
import { canAccessEnterpriseTeamSettings } from "@/lib/enterprise/team-access";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";
import { getAdvisorDashboardData } from "@/lib/actions/advisor-actions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { AdvisorSrOnlyHeading } from "@/components/advisor/AdvisorSrOnlyHeading";
import { AdvisorControlCenterLayout } from "@/components/advisor/layout/AdvisorControlCenterLayout";

export default async function AdvisorLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  const role = session?.user?.role?.toString().toUpperCase();
  if (!isAdvisorHubNavRole(role)) {
    redirect("/dashboard?error=unauthorized");
  }

  if (role === "ADVISOR" && userId) {
    const pathname = (await headers()).get("x-akili-pathname") ?? "";
    const onBillingPage = pathname === "/advisor/billing";
    if (!onBillingPage) {
      const hub = await getAdvisorHubAccessForUserId(userId);
      if (!hub.allowed) {
        if (hub.blockReason === "deactivated") {
          redirect(
            `/api/auth/signout?callbackUrl=${encodeURIComponent("/signin?notice=account_deactivated")}`
          );
        }
        redirect(
          hub.blockReason === "disabled"
            ? "/settings?notice=advisor_portal_disabled"
            : hub.blockReason === "suspended"
              ? "/signin?notice=enterprise_suspended"
              : "/advisor/billing"
        );
      }
    }
  }

  const [featureFlags, dash, enterpriseTeamEnabled] = await Promise.all([
    getPlatformFeatureFlags(),
    getAdvisorDashboardData(),
    userId ? canAccessEnterpriseTeamSettings(userId) : Promise.resolve(false),
  ]);

  const unreadNotificationCount = dash.success
    ? dash.data!.unreadNotificationCount
    : 0;

  return (
    <AdvisorControlCenterLayout
      featureFlags={featureFlags}
      unreadNotificationCount={unreadNotificationCount}
      enterpriseTeamEnabled={enterpriseTeamEnabled}
    >
      <AdvisorSrOnlyHeading />
      {children}
    </AdvisorControlCenterLayout>
  );
}
