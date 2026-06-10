import { redirect } from "next/navigation";

import {
  BillingDashboard,
  EnterpriseBillingDashboard,
} from "@/components/advisor/billing/BillingDashboard";
import { isAdvisorBillingDebugEnabled } from "@/lib/billing/advisor-billing-debug";
import { fetchPlanPricesForUi } from "@/lib/billing/plan-price-display";
import { emptyPlanPricesForUi } from "@/lib/billing/plan-prices-ui";
import { getBillingPageData } from "@/lib/actions/billing";

export default async function AdvisorBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const sp = await searchParams;
  const checkout =
    sp.checkout === "success" ? "success" : sp.checkout === "cancel" ? "cancel" : null;

  const billingEnabled = process.env.ENABLE_BILLING_FEATURES !== "false";

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

  const planPrices = billingEnabled
    ? await fetchPlanPricesForUi()
    : emptyPlanPricesForUi();
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
      billingEnabled={billingEnabled}
      planPrices={planPrices}
      debugBilling={isAdvisorBillingDebugEnabled()}
    />
  );
}
