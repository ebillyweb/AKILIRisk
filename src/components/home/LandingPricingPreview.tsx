import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LandingSectionBand } from "@/components/marketing/LandingSectionBand";
import { MarketingSection } from "@/components/marketing/MarketingSection";
import { SELF_SERVE_TIERS, TIER_CATALOG } from "@/lib/billing/tier-catalog";
import type { PublicTierPricing } from "@/lib/billing/public-tier-pricing";
import { Button } from "@/components/ui/button";
import { MarketingSurfaceCard } from "@/components/marketing/MarketingSurfaceCard";

type LandingPricingPreviewProps = {
  pricing?: PublicTierPricing[];
};

export function LandingPricingPreview({ pricing = [] }: LandingPricingPreviewProps) {
  const rows = pricing ?? [];
  const essentials = rows.find((row) => row.tier === "ESSENTIALS");
  const startingMonthly = essentials?.monthly?.display ?? null;

  return (
    <LandingSectionBand variant="inset">
      <MarketingSection
        id="pricing"
        kicker="Pricing"
        title="Modular tiers that grow with your practice"
        description="Essentials through Platinum for solo advisors and enterprise firms."
        className="!space-y-8"
      >
      {startingMonthly ? (
        <p className="-mt-4 text-sm text-muted-foreground">
          From{" "}
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {startingMonthly}
          </span>
          <span className="text-muted-foreground"> /mo</span>
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SELF_SERVE_TIERS.map((tier) => {
          const catalog = TIER_CATALOG[tier];
          return (
            <MarketingSurfaceCard key={tier} className="space-y-2">
              <h3 className="font-display text-lg font-semibold text-foreground">
                {catalog.name}
              </h3>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {catalog.modules}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">{catalog.tagline}</p>
            </MarketingSurfaceCard>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="min-h-12">
          <Link href="/pricing">
            View plans & subscribe
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="min-h-12">
          <Link href="/contact?intent=enterprise">Enterprise pricing</Link>
        </Button>
      </div>
    </MarketingSection>
    </LandingSectionBand>
  );
}
