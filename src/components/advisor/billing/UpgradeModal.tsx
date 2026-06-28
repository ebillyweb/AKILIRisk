"use client";

import Link from "next/link";

import { billingPlanNavigationLabel } from "@/lib/billing/billing-plan-cta";
import { Button } from "@/components/ui/button";

/** Entry point to Stripe Checkout / billing (spec upgrade flow without embedded Elements). */
export function UpgradeModalTrigger({
  upgradePath = "/advisor/billing",
  label = billingPlanNavigationLabel(),
}: {
  upgradePath?: string;
  label?: string;
}) {
  return (
    <Button asChild>
      <Link href={upgradePath}>{label}</Link>
    </Button>
  );
}
