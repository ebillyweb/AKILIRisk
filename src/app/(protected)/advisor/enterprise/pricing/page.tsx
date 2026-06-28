import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { EnterprisePricingPageContent } from "@/components/marketing/EnterprisePricingPageContent";
import { requireAdvisorSession } from "@/lib/advisor/auth";
import { fetchPublicTierPricing } from "@/lib/billing/public-tier-pricing";
import { isModuleTier } from "@/lib/billing/plan-prices-ui";
import { parseSignupCheckoutIntent } from "@/lib/billing/tier-catalog";
import { resolveBillingContext } from "@/lib/enterprise/billing-context";
import {
  enterpriseNeedsCardCheckout,
  getEnterprisePricingFirmContext,
} from "@/lib/enterprise/pricing-page-access";

export const metadata: Metadata = {
  title: "Firm subscription",
  robots: { index: false, follow: false },
};

export default async function EnterprisePricingPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    checkout_plan?: string;
    checkout_cycle?: string;
  }>;
}) {
  const { userId } = await requireAdvisorSession();
  const sp = await searchParams;

  const billingCtx = await resolveBillingContext(userId);

  if (!billingCtx || billingCtx.kind !== "enterprise") {
    redirect("/pricing");
  }

  if (billingCtx.role !== "OWNER") {
    redirect("/advisor/billing");
  }

  const firm = await getEnterprisePricingFirmContext(userId);
  if (!firm) {
    redirect("/advisor/billing");
  }

  if (firm.paymentMethod === "WIRE") {
    redirect("/advisor/billing");
  }

  if (!enterpriseNeedsCardCheckout(firm)) {
    redirect("/advisor/billing");
  }

  const urlCheckoutIntent = parseSignupCheckoutIntent(sp);

  const { pricing, configErrors } = await fetchPublicTierPricing();

  const contractedTier =
    firm.currentModuleTier && isModuleTier(firm.currentModuleTier)
      ? firm.currentModuleTier
      : null;
  const contractedCycle =
    firm.contractedBillingCycle === "MONTHLY" ||
    firm.contractedBillingCycle === "ANNUAL"
      ? firm.contractedBillingCycle
      : null;

  const checkoutPlanIntent =
    urlCheckoutIntent ??
    (contractedTier && contractedCycle
      ? { tier: contractedTier, billingCycle: contractedCycle }
      : null);

  return (
    <EnterprisePricingPageContent
      pricing={pricing}
      configErrors={configErrors}
      firm={firm}
      checkoutPlanIntent={checkoutPlanIntent}
    />
  );
}
