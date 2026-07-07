import { TierFeatureLockedPage } from "@/components/advisor/billing/TierFeatureLockedPage";
import { requireAdvisorTierFeatureAccess } from "@/lib/advisor/tier-feature-guard.server";
import { requireAdvisorRiskIntelligenceEnabled } from "@/lib/platform/advisor-feature-guards";

export default async function AdvisorIntelligenceFeatureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdvisorRiskIntelligenceEnabled();
  const access = await requireAdvisorTierFeatureAccess("RISK_INTELLIGENCE");
  if (!access.allowed) {
    return (
      <TierFeatureLockedPage
        feature="RISK_INTELLIGENCE"
        currentTier={access.currentTier}
      />
    );
  }
  return <>{children}</>;
}
