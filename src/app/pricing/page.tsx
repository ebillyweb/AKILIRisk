import type { Metadata } from "next";
import type { BillingCycle } from "@prisma/client";

import { PricingPageContent } from "@/components/marketing/PricingPageContent";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { getSubscriptionDetails } from "@/lib/actions/billing";
import { fetchPublicTierPricing } from "@/lib/billing/public-tier-pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AKILI modular pricing for advisors and enterprise firms — Essentials through Platinum with assessment, customization, implementation tracking, and continuous monitoring.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [session, pricing] = await Promise.all([auth(), fetchPublicTierPricing()]);
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
      canSubscribe={canSubscribe}
      advisorSubscription={advisorSubscription}
      initialBillingCycle={initialBillingCycle}
    />
  );
}
