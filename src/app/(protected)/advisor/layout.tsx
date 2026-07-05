import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import {
  getAdvisorHubAccessForUserId,
} from "@/lib/advisor/auth";
import { resolveAdvisorCheckoutBillingHref } from "@/lib/advisor/checkout-billing-redirect";
import { getAdvisorClientLimitStatus } from "@/lib/advisor/client-limit-status.server";
import { getAdvisorSubscriptionTier } from "@/lib/advisor/subscription-tier.server";
import { canAccessEnterpriseTeamSettings } from "@/lib/enterprise/team-access";
import { canAccessAdvisorBilling } from "@/lib/enterprise/billing-details";
import { resolveAdvisorWorkspaceTitleForUserId } from "@/lib/advisor/advisor-workspace-label.server";
import { getAdvisorDashboardData } from "@/lib/actions/advisor-actions";
import { isImplementationTrackingEnabledForUser } from "@/lib/engagement/feature-flags";
import {
  isEnterpriseMemberVisibilityEnabled,
  resolveEnterpriseMemberVisibilityContext,
} from "@/lib/enterprise/advisor-member-visibility";
import { getPlatformFeatureFlags } from "@/lib/platform/feature-flags";
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

  const pathname = (await headers()).get("x-akili-pathname") ?? "";
  const onBillingPage = pathname === "/advisor/billing";

  if (role === "ADVISOR" && userId) {
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
              : await resolveAdvisorCheckoutBillingHref(userId)
        );
      }
    }
  }

  const [featureFlags, dash, enterpriseTeamEnabled, billingNavEnabled, implementationTrackingEnabled, memberVisibilityContext, workspaceTitle, subscriptionTier, clientLimitStatus] =
    await Promise.all([
    getPlatformFeatureFlags(),
    onBillingPage
      ? Promise.resolve({
          success: true as const,
          data: { unreadNotificationCount: 0 },
        })
      : getAdvisorDashboardData(),
    userId ? canAccessEnterpriseTeamSettings(userId) : Promise.resolve(false),
    userId ? canAccessAdvisorBilling(userId) : Promise.resolve(true),
    userId ? isImplementationTrackingEnabledForUser(userId) : Promise.resolve(true),
    userId
      ? resolveEnterpriseMemberVisibilityContext(userId)
      : Promise.resolve({
          applyRestrictions: false,
          settings: {
            portfolio: true,
            assessmentLeads: true,
            methodology: true,
            engagements: true,
            reassessment: true,
            productTours: true,
            hideTierLockedNav: false,
            skipIntake: false,
            skipPostIntakeReview: false,
            documentRequirements: true,
            actionPlan: true,
          },
          enterpriseId: null,
          role: null,
        }),
    resolveAdvisorWorkspaceTitleForUserId(userId),
    userId ? getAdvisorSubscriptionTier(userId) : Promise.resolve("ESSENTIALS" as const),
    userId ? getAdvisorClientLimitStatus(userId) : Promise.resolve(null),
  ]);

  const unreadNotificationCount = dash.success
    ? dash.data!.unreadNotificationCount
    : 0;

  const workspacePreferences = {
    productToursEnabled: isEnterpriseMemberVisibilityEnabled(
      memberVisibilityContext,
      "productTours",
    ),
    // Sidebar reflects firm visibility for every enterprise login; route guards still
    // exempt OWNER/ADMIN via isEnterpriseMemberVisibilityEnabled(applyRestrictions).
    applyEnterpriseMemberVisibility: memberVisibilityContext.enterpriseId !== null,
    enterpriseMemberVisibility: memberVisibilityContext.settings,
  };

  return (
    <AdvisorControlCenterLayout
      featureFlags={featureFlags}
      subscriptionTier={subscriptionTier}
      clientLimitStatus={clientLimitStatus}
      unreadNotificationCount={unreadNotificationCount}
      workspaceTitle={workspaceTitle}
      enterpriseTeamEnabled={enterpriseTeamEnabled}
      billingNavEnabled={billingNavEnabled}
      implementationTrackingEnabled={implementationTrackingEnabled}
      workspacePreferences={workspacePreferences}
    >
      <AdvisorSrOnlyHeading />
      {children}
    </AdvisorControlCenterLayout>
  );
}
