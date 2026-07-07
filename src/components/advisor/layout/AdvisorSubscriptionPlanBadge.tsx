import type { SubscriptionTier } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { TIER_DISPLAY_NAME, type SelfServeTier } from "@/lib/billing/tier-catalog";
import { cn } from "@/lib/utils";

type AdvisorSubscriptionPlanBadgeProps = {
  subscriptionTier: SubscriptionTier;
  className?: string;
};

function subscriptionTierLabel(tier: SubscriptionTier): string {
  return TIER_DISPLAY_NAME[tier as SelfServeTier];
}

export function AdvisorSubscriptionPlanBadge({
  subscriptionTier,
  className,
}: AdvisorSubscriptionPlanBadgeProps) {
  return (
    <Badge
      variant={subscriptionTier === "BUSINESS" ? "default" : "secondary"}
      className={cn(
        "px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        className,
      )}
    >
      {subscriptionTierLabel(subscriptionTier)}
    </Badge>
  );
}
