import { Lock } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";

import {
  TIER_FEATURE_COPY,
  tierUpgradeMessage,
  type AdvisorTierFeatureKey,
} from "@/lib/billing/tier-features";
import { TierFeatureUpgradeButton } from "@/components/advisor/billing/TierFeatureUpgrade";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function TierFeatureLockedPage({
  feature,
  currentTier,
}: {
  feature: AdvisorTierFeatureKey;
  currentTier: SubscriptionTier;
}) {
  const copy = TIER_FEATURE_COPY[feature];

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
      <Card className="w-full border-dashed shadow-none">
        <CardHeader className="items-center space-y-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Lock className="size-5 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-2">
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription className="text-base leading-6">
              {copy.description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {tierUpgradeMessage(feature, currentTier)}
          </p>
          <TierFeatureUpgradeButton feature={feature} className="w-full sm:w-auto" />
        </CardContent>
      </Card>
    </div>
  );
}
