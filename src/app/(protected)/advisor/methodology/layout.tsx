import { TierFeatureLockedPage } from "@/components/advisor/billing/TierFeatureLockedPage";
import { requireAdvisorTierFeatureAccess } from "@/lib/advisor/tier-feature-guard.server";
import { requireAdvisorMethodologyMemberAccess } from "@/lib/platform/advisor-feature-guards";

export default async function AdvisorMethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdvisorMethodologyMemberAccess();

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
