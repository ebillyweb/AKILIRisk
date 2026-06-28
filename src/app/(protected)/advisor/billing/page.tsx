import { redirect } from "next/navigation";

import {
  BillingDashboard,
  EnterpriseBillingDashboard,
} from "@/components/advisor/billing/BillingDashboard";
import { isAdvisorBillingDebugEnabled } from "@/lib/billing/advisor-billing-debug";
import { isBillingEnabled } from "@/lib/billing/config";
import { fetchPublicTierPricing } from "@/lib/billing/public-tier-pricing";
import { getBillingPageData } from "@/lib/actions/billing";

export default async function AdvisorBillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    notice?: string;
    checkout_plan?: string;
    checkout_cycle?: string;
  }>;
}) {
  const sp = await searchParams;
  const checkout =
    sp.checkout === "success" ? "success" : sp.checkout === "cancel" ? "cancel" : null;
  const subscriptionRequiredNotice = sp.notice === "subscription_required";
  const checkoutPlan =
    sp.checkout_plan === "ESSENTIALS" ||
    sp.checkout_plan === "PROFESSIONAL" ||
    sp.checkout_plan === "BUSINESS" ||
    sp.checkout_plan === "PLATINUM"
      ? sp.checkout_plan
      : null;
  const checkoutCycle =
    sp.checkout_cycle === "MONTHLY" || sp.checkout_cycle === "ANNUAL"
      ? sp.checkout_cycle
      : null;

  const billingEnabled = isBillingEnabled();

  const pageRes = await getBillingPageData();
  if (!pageRes.success) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {pageRes.error}
      </div>
    );
  }

  if (pageRes.data.mode === "unavailable") {
    redirect("/advisor");
  }

  if (pageRes.data.mode === "enterprise") {
    return (
      <EnterpriseBillingDashboard
        enterprise={pageRes.data.enterprise}
        initialInvoices={pageRes.data.invoices}
        billingEnabled={billingEnabled}
      />
    );
  }

  const { pricing, configErrors } = billingEnabled
    ? await fetchPublicTierPricing()
    : { pricing: [], configErrors: [] as string[] };
  const sub = pageRes.data.subscription;

  if (isAdvisorBillingDebugEnabled()) {
    console.debug("[advisor-billing] server AdvisorBillingPage subscription payload", {
      checkoutNotice: checkout,
      billingEnabled,
      rawSubscription: sub
        ? {
            tier: sub.tier,
            status: sub.status,
            billingCycle: sub.billingCycle,
            clientLimit: sub.clientLimit,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            stripeCustomerId: sub.stripeCustomerId,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            currentClientCount: sub.currentClientCount,
            canAddClient: sub.canAddClient,
          }
        : null,
    });
  }

  return (
    <BillingDashboard
      key={[
        sub?.stripeSubscriptionId ?? "no-sub",
        sub?.tier,
        sub?.billingCycle,
        sub?.status,
      ].join(":")}
      initialSubscription={sub}
      initialInvoices={pageRes.data.invoices}
      checkoutNotice={checkout}
      subscriptionRequiredNotice={subscriptionRequiredNotice}
      billingEnabled={billingEnabled}
      pricing={pricing}
      configErrors={configErrors}
      debugBilling={isAdvisorBillingDebugEnabled()}
      checkoutPlanIntent={
        checkoutPlan && checkoutCycle
          ? { tier: checkoutPlan, billingCycle: checkoutCycle }
          : null
      }
    />
  );
}
