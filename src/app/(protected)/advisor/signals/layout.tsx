import { TierFeatureLockedPage } from "@/components/advisor/billing/TierFeatureLockedPage";
import { requireAdvisorTierFeatureAccess } from "@/lib/advisor/tier-feature-guard.server";
import { requireAdvisorRiskIntelligenceEnabled } from "@/lib/platform/advisor-feature-guards";

export default async function AdvisorSignalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdvisorRiskIntelligenceEnabled();
  const access = await requireAdvisorTierFeatureAccess("CONTINUOUS_MONITORING");
  if (!access.allowed) {
    return (
      <TierFeatureLockedPage
        feature="CONTINUOUS_MONITORING"
        currentTier={access.currentTier}
      />
    );
  }
  return <>{children}</>;
}
