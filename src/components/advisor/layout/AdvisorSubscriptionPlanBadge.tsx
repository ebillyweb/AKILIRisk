import type { SubscriptionTier } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import { isModuleTier } from "@/lib/billing/plan-prices-ui";
import { cn } from "@/lib/utils";

type AdvisorSubscriptionPlanBadgeProps = {
  subscriptionTier: SubscriptionTier;
  className?: string;
};

function subscriptionTierLabel(tier: SubscriptionTier): string {
  if (isModuleTier(tier)) return TIER_DISPLAY_NAME[tier];
  return tier.charAt(0) + tier.slice(1).toLowerCase();
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
