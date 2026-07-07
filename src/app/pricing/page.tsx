import type { Metadata } from "next";
import type { BillingCycle } from "@prisma/client";

import { PricingPageContent } from "@/components/marketing/PricingPageContent";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { getSubscriptionDetails } from "@/lib/actions/billing";
import { fetchPublicTierPricing } from "@/lib/billing/public-tier-pricing";
import { withCanonical } from "@/lib/seo/site";

export const metadata: Metadata = withCanonical("/pricing", {
  title: "Pricing",
  description:
    "Compare AKILI Essentials through Platinum — see what each module tier includes, client limits, and which capabilities unlock as you upgrade.",
});

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [{ pricing, configErrors }, session] = await Promise.all([
    fetchPublicTierPricing(),
    auth(),
  ]);
  const canSubscribe = Boolean(
    session?.user?.id && isAdvisorHubNavRole(session.user.role),
  );

  let advisorSubscription = null;
  let initialBillingCycle: BillingCycle | undefined;

  if (canSubscribe) {
    const subRes = await getSubscriptionDetails();
    if (subRes.success) {
      advisorSubscription = subRes.data;
      if (
        advisorSubscription &&
        advisorSubscription.status !== "NONE" &&
        advisorSubscription.status !== "CANCELLED"
      ) {
        initialBillingCycle = advisorSubscription.billingCycle;
      }
    }
  }

  return (
    <PricingPageContent
      pricing={pricing}
      configErrors={configErrors}
      canSubscribe={canSubscribe}
      advisorSubscription={advisorSubscription}
      initialBillingCycle={initialBillingCycle}
    />
  );
}
