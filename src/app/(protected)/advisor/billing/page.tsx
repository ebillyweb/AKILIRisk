import { BillingDashboard } from "@/components/advisor/billing/BillingDashboard";
import { getBillingHistory, getSubscriptionDetails } from "@/lib/actions/billing";
import { isAdvisorBillingDebugEnabled } from "@/lib/billing/advisor-billing-debug";
import { fetchPlanPricesForUi } from "@/lib/billing/plan-price-display";
import { emptyPlanPricesForUi } from "@/lib/billing/plan-prices-ui";

export default async function AdvisorBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const sp = await searchParams;
  const checkout =
    sp.checkout === "success" ? "success" : sp.checkout === "cancel" ? "cancel" : null;

  const billingEnabled = process.env.ENABLE_BILLING_FEATURES !== "false";

  const subRes = await getSubscriptionDetails();
  const [invRes, planPrices] = await Promise.all([
    getBillingHistory(),
    billingEnabled ? fetchPlanPricesForUi() : Promise.resolve(emptyPlanPricesForUi()),
  ]);

  if (!subRes.success) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {subRes.error}
      </div>
    );
  }

  const invoices = invRes.success ? invRes.data : [];
  const sub = subRes.data;

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
      initialInvoices={invoices}
      checkoutNotice={checkout}
      billingEnabled={billingEnabled}
      planPrices={planPrices}
      debugBilling={isAdvisorBillingDebugEnabled()}
    />
  );
}
