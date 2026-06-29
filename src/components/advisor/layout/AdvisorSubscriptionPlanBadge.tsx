import type { SubscriptionTier } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AdvisorSubscriptionPlanBadgeProps = {
  subscriptionTier: SubscriptionTier;
  className?: string;
};

export function AdvisorSubscriptionPlanBadge({
  subscriptionTier,
  className,
}: AdvisorSubscriptionPlanBadgeProps) {
  return (
    <Badge
      variant={subscriptionTier === "BUSINESS" ? "default" : "secondary"}
      className={cn(
        "px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {subscriptionTier} plan
    </Badge>
  );
}
