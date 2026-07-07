import { TierFeatureLockedPage } from "@/components/advisor/billing/TierFeatureLockedPage";
import { requireAdvisorTierFeatureAccess } from "@/lib/advisor/tier-feature-guard.server";
import { requireAdvisorGovernanceDashboardEnabled } from "@/lib/platform/advisor-feature-guards";

export default async function AdvisorDashboardFeatureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdvisorGovernanceDashboardEnabled();
  const access = await requireAdvisorTierFeatureAccess("PORTFOLIO_ANALYTICS");
  if (!access.allowed) {
    return (
      <TierFeatureLockedPage
        feature="PORTFOLIO_ANALYTICS"
        currentTier={access.currentTier}
      />
    );
  }
  return <>{children}</>;
}
