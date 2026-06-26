import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PricingTierGrid } from "@/components/marketing/PricingTierGrid";
import { SELF_SERVE_TIERS, TIER_CATALOG } from "@/lib/billing/tier-catalog";
import type { PublicTierPricing } from "@/lib/billing/public-tier-pricing";
import { Button } from "@/components/ui/button";

type LandingPricingPreviewProps = {
  pricing: PublicTierPricing[];
};

export function LandingPricingPreview({ pricing }: LandingPricingPreviewProps) {
  const essentials = pricing.find((row) => row.tier === "ESSENTIALS");
  const startingMonthly = essentials?.monthly?.display ?? null;

  return (
    <section className="mt-10" aria-labelledby="home-pricing-heading">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <p className="editorial-kicker">Pricing</p>
          <h2
            id="home-pricing-heading"
            className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            Modular tiers that grow with your practice
          </h2>
          <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
            Essentials through Platinum — the same module ladder for solo advisors and
            enterprise firms. Subscribe self-serve or talk to sales for multi-seat firms.
          </p>
        </div>
        {startingMonthly ? (
          <p className="text-sm text-muted-foreground">
            From{" "}
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {startingMonthly}
            </span>
            <span className="text-muted-foreground"> /mo</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SELF_SERVE_TIERS.map((tier) => {
          const catalog = TIER_CATALOG[tier];
          return (
            <div
              key={tier}
              className="rounded-[1.25rem] border border-border/70 bg-card/80 px-5 py-5"
            >
              <h3 className="font-display text-lg font-semibold text-foreground">
                {catalog.name}
              </h3>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {catalog.modules}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {catalog.tagline}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/pricing">
            View plans & subscribe
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/contact?intent=enterprise">Enterprise pricing</Link>
        </Button>
      </div>
    </section>
  );
}
