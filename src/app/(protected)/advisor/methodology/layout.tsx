import { TierFeatureLockedPage } from "@/components/advisor/billing/TierFeatureLockedPage";
import { requireAdvisorTierFeatureAccess } from "@/lib/advisor/tier-feature-guard.server";

export default async function AdvisorMethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAdvisorTierFeatureAccess("METHODOLOGY_CUSTOMIZATION");
  if (!access.allowed) {
    return (
      <TierFeatureLockedPage
        feature="METHODOLOGY_CUSTOMIZATION"
        currentTier={access.currentTier}
      />
    );
  }
  return <>{children}</>;
}
