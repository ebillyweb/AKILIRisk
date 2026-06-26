"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import { Lock } from "lucide-react";
import type { SubscriptionTier } from "@prisma/client";

import {
  advisorTierFeatureBillingHref,
  minimumTierForFeature,
  TIER_FEATURE_COPY,
  tierUpgradeMessage,
  tierIncludesFeature,
  type AdvisorTierFeatureKey,
} from "@/lib/billing/tier-features";
import { TIER_DISPLAY_NAME } from "@/lib/billing/tier-catalog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function TierFeatureLockIcon({
  className,
  label = "Requires plan upgrade",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Lock
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
      aria-label={label}
    />
  );
}

export function TierFeatureUpgradeDialog({
  feature,
  currentTier,
  open,
  onOpenChange,
}: {
  feature: AdvisorTierFeatureKey;
  currentTier: SubscriptionTier;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const requiredTier = minimumTierForFeature(feature);
  const copy = TIER_FEATURE_COPY[feature];
  const billingHref = advisorTierFeatureBillingHref(feature);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted">
            <Lock className="size-4 text-muted-foreground" aria-hidden />
          </div>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription className="text-left leading-6">
            {copy.description}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {tierUpgradeMessage(feature, currentTier)}
        </p>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button asChild>
            <Link href={billingHref} onClick={() => onOpenChange(false)}>
              Upgrade to {TIER_DISPLAY_NAME[requiredTier]}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TierFeatureUpgradeButton({
  feature,
  className,
  size = "default",
}: {
  feature: AdvisorTierFeatureKey;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  const requiredTier = minimumTierForFeature(feature);
  return (
    <Button asChild className={className} size={size}>
      <Link href={advisorTierFeatureBillingHref(feature)}>
        Upgrade to {TIER_DISPLAY_NAME[requiredTier]}
      </Link>
    </Button>
  );
}

export function GatedQuickActionButton({
  href,
  label,
  description,
  icon: Icon,
  currentTier,
  feature,
}: {
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  currentTier: SubscriptionTier;
  feature?: AdvisorTierFeatureKey;
}) {
  const [open, setOpen] = useState(false);
  const locked = feature ? !tierIncludesFeature(currentTier, feature) : false;

  if (!locked) {
    return (
      <Button asChild variant="outline" className="h-auto min-h-[4.5rem] justify-start px-4 py-3">
        <Link href={href} className="flex w-full items-start gap-3 text-left">
          <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs font-normal text-muted-foreground">{description}</span>
          </span>
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-[4.5rem] justify-start px-4 py-3 text-muted-foreground"
        onClick={() => setOpen(true)}
        aria-label={`${label} — upgrade required`}
      >
        <span className="flex w-full items-start gap-3 text-left">
          <Icon className="mt-0.5 size-4 shrink-0 opacity-80" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{label}</span>
            <span className="block text-xs font-normal text-muted-foreground">{description}</span>
          </span>
          <TierFeatureLockIcon className="mt-0.5 !opacity-100" />
        </span>
      </Button>
      {feature ? (
        <TierFeatureUpgradeDialog
          feature={feature}
          currentTier={currentTier}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}
