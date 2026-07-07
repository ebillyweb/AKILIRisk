import { redirect } from "next/navigation";

import { TierFeatureLockedPage } from "@/components/advisor/billing/TierFeatureLockedPage";
import { requireAdvisorRole, getAdvisorProfileOrThrow } from "@/lib/advisor/auth";
import { requireAdvisorTierFeatureAccess } from "@/lib/advisor/tier-feature-guard.server";
import { isImplementationTrackingEnabled } from "@/lib/engagement/feature-flags";
import { requireAdvisorEngagementsMemberAccess } from "@/lib/platform/advisor-feature-guards";

export default async function AdvisorEngagementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdvisorEngagementsMemberAccess();

  const access = await requireAdvisorTierFeatureAccess("IMPLEMENTATION_ENGAGEMENTS");
  if (!access.allowed) {
    return (
      <TierFeatureLockedPage
        feature="IMPLEMENTATION_ENGAGEMENTS"
        currentTier={access.currentTier}
      />
    );
  }

  try {
    const { userId } = await requireAdvisorRole();
    const profile = await getAdvisorProfileOrThrow(userId);
    const trackingEnabled = await isImplementationTrackingEnabled(profile.id);
    if (!trackingEnabled) {
      redirect("/advisor");
    }
  } catch {
    redirect("/advisor");
  }

  return <>{children}</>;
}
