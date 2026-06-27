import Link from "next/link";
import { PricingTierGrid } from "@/components/marketing/PricingTierGrid";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
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
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>
      <main id="main-content" className="min-h-screen pb-10 pt-2 sm:pb-12" tabIndex={-1}>
      <div className="page-shell space-y-12">
        <SiteHeader />
        <div className="mx-auto max-w-6xl space-y-12">
          <header className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card/70 px-6 py-10 sm:px-10 sm:py-12">
            <div
              className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand/10 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-trust-accent/10 blur-3xl"
              aria-hidden
            />
            <div className="relative space-y-6">
              <div className="max-w-3xl space-y-4">
                <p className="editorial-kicker">Pricing</p>
                <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl">
                  Modular governance intelligence, priced to scale with your practice
                </h1>
                <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                  Four capability tiers — Essentials through Platinum — stack as you grow.
                  Solo advisors subscribe self-serve; enterprise firms license the same modules
                  with shared branding and multiple advisor seats.
                </p>
              </div>
            </div>
          </header>

          <PricingTierGrid
            pricing={pricing}
            billingEnabled={billingEnabled}
            canSubscribe={canSubscribe}
            advisorSubscription={advisorSubscription}
            initialBillingCycle={initialBillingCycle}
          />

          <div className="space-y-8">
            <Link
              href="/"
              className="inline-block text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Back to home
            </Link>
            <SiteFooter />
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
