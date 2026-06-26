import { TierFeatureLockedPage } from "@/components/advisor/billing/TierFeatureLockedPage";
import { requireAdvisorTierFeatureAccess } from "@/lib/advisor/tier-feature-guard.server";

export default async function AdvisorEngagementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAdvisorTierFeatureAccess("IMPLEMENTATION_ENGAGEMENTS");
  if (!access.allowed) {
    return (
      <TierFeatureLockedPage
        feature="IMPLEMENTATION_ENGAGEMENTS"
        currentTier={access.currentTier}
      />
    );
  }
  return <>{children}</>;
}
