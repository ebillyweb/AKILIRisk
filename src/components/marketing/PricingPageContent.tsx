import { MarketingPageHero } from "@/components/marketing/MarketingPageHero";
import { PricingTierGrid } from "@/components/marketing/PricingTierGrid";
import { PublicPageShell } from "@/components/marketing/PublicPageShell";
import { isBillingEnabled } from "@/lib/billing/config";
import type { SubscriptionDetailsDTO } from "@/lib/actions/billing";
import type { PublicTierPricing } from "@/lib/billing/public-tier-pricing";
import type { BillingCycle } from "@prisma/client";

type PricingPageContentProps = {
  pricing: PublicTierPricing[];
  canSubscribe: boolean;
  advisorSubscription?: SubscriptionDetailsDTO | null;
  initialBillingCycle?: BillingCycle;
};

export function PricingPageContent({
  pricing,
  canSubscribe,
  advisorSubscription = null,
  initialBillingCycle,
}: PricingPageContentProps) {
  const billingEnabled = isBillingEnabled();

  return (
    <PublicPageShell maxWidth="wide">
      <MarketingPageHero
        kicker="Pricing"
        title="Modular governance intelligence, priced to scale with your practice"
        description="Four capability tiers — Essentials through Platinum — stack as you grow. Solo advisors subscribe self-serve; enterprise firms license the same modules with shared branding and multiple advisor seats."
      />

      <PricingTierGrid
        pricing={pricing}
        billingEnabled={billingEnabled}
        canSubscribe={canSubscribe}
        advisorSubscription={advisorSubscription}
        initialBillingCycle={initialBillingCycle}
      />
    </PublicPageShell>
  );
}
