import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PricingTierGrid } from "@/components/marketing/PricingTierGrid";
import { SELF_SERVE_TIERS, TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import { isBillingEnabled } from "@/lib/billing/config";
import type { PublicTierPricing } from "@/lib/billing/public-tier-pricing";
import type { EnterprisePricingFirmContext } from "@/lib/enterprise/pricing-page-access";
import { Button } from "@/components/ui/button";

type EnterprisePricingPageContentProps = {
  pricing: PublicTierPricing[];
  firm: EnterprisePricingFirmContext;
  checkoutPlanIntent?: {
    tier: (typeof SELF_SERVE_TIERS)[number];
    billingCycle: "MONTHLY" | "ANNUAL";
  } | null;
};

export function EnterprisePricingPageContent({
  pricing,
  firm,
  checkoutPlanIntent = null,
}: EnterprisePricingPageContentProps) {
  const billingEnabled = isBillingEnabled();
  const contractedTier =
    firm.currentModuleTier &&
    SELF_SERVE_TIERS.includes(firm.currentModuleTier as (typeof SELF_SERVE_TIERS)[number])
      ? TIER_DISPLAY_NAME[firm.currentModuleTier as (typeof SELF_SERVE_TIERS)[number]]
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card/70 px-6 py-8 sm:px-8 sm:py-10">
        <div
          className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-brand/10 blur-3xl"
          aria-hidden
        />
        <div className="relative space-y-4">
          <p className="editorial-kicker">Firm subscription</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {contractedTier
              ? `Complete checkout for ${firm.enterpriseName}`
              : `Choose your module tier for ${firm.enterpriseName}`}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            {contractedTier
              ? `Your contract includes the ${contractedTier} module tier. Complete Stripe checkout to activate firm billing — shared branding, ${firm.seatLimit} advisor seats, and centralized subscription management.`
              : `Your agreement is in place. Select Essentials through Platinum to activate firm billing — shared branding, ${firm.seatLimit} advisor seats, and centralized subscription checkout on Stripe.`}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild variant="outline" size="sm">
              <Link href="/advisor/billing">Back to billing</Link>
            </Button>
          </div>
        </div>
      </header>

      <PricingTierGrid
        pricing={pricing}
        billingEnabled={billingEnabled}
        canSubscribe
        audience="enterprise"
        firm={firm}
        checkoutPlanIntent={checkoutPlanIntent}
      />

      <section className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-5 py-5 text-sm leading-7 text-muted-foreground sm:px-6">
        <p>
          This page is private to your firm owner account. After checkout, manage receipts and
          payment methods from{" "}
          <Link href="/advisor/billing" className="font-semibold text-foreground underline-offset-4 hover:underline">
            Billing
          </Link>
          . Questions about your contract?{" "}
          <Link href="/contact?intent=enterprise" className="font-semibold text-foreground underline-offset-4 hover:underline">
            Contact sales
            <ArrowRight className="ml-0.5 inline size-3.5" aria-hidden />
          </Link>
        </p>
      </section>
    </div>
  );
}
