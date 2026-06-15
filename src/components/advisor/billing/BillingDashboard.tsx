"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Download, ExternalLink, AlertCircle } from "lucide-react";

import {
  createCheckoutSession,
  createPortalSession,
  switchSubscriptionPlan,
  type BillingInvoiceDTO,
  type SubscriptionDetailsDTO,
} from "@/lib/actions/billing";
import { isAdvisorBillingDebugEnabled } from "@/lib/billing/advisor-billing-debug";
import { TIER_LIMITS } from "@/lib/billing/constants";
import type { PlanPricesForUi } from "@/lib/billing/plan-prices-ui";
import type { EnterpriseBillingSummary } from "@/lib/enterprise/billing-details";
import type { BillingCycle, SubscriptionTier } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EnterpriseSalesContactDialog } from "@/components/advisor/billing/EnterpriseSalesContactDialog";

const TIER_ORDER: SubscriptionTier[] = ["STARTER", "GROWTH", "PROFESSIONAL"];

const TIER_RANK: Record<SubscriptionTier, number> = {
  STARTER: 0,
  GROWTH: 1,
  PROFESSIONAL: 2,
  ENTERPRISE: 3,
};

const TIER_LABEL: Record<SubscriptionTier, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function SubscriptionOverview({
  data,
}: {
  data: SubscriptionDetailsDTO;
}) {
  /** Synthetic row from `getSubscriptionDetails` when there is no DB `Subscription` and Stripe reconcile found nothing. */
  if (data.status === "NONE") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" aria-hidden />
            Current plan
          </CardTitle>
          <CardDescription>
            No subscription is on file yet. Choose a plan below to start checkout; after
            payment, this card shows your tier and renewal date from Stripe.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            If you already completed checkout, wait a few seconds and refresh—this page
            polls until Stripe webhooks link your subscription.
          </p>
        </CardContent>
      </Card>
    );
  }

  const periodEnd = new Date(data.currentPeriodEnd);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5" aria-hidden />
          Current plan
        </CardTitle>
        <CardDescription>
          Subscription status and renewal information synced from Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium">{TIER_LABEL[data.tier]}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium">{data.status.replace(/_/g, " ")}</span>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-muted-foreground">Billing</span>
          <span className="font-medium">
            {data.billingCycle === "ANNUAL" ? "Annual" : "Monthly"}
          </span>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-muted-foreground">Current period ends</span>
          <span className="font-medium">{periodEnd.toLocaleDateString()}</span>
        </div>
        {data.cancelAtPeriodEnd ? (
          <p className="text-amber-600 dark:text-amber-500 pt-2">
            Your subscription is set to cancel at the end of this billing period.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function UsageBar({
  label,
  current,
  limit,
  description,
  atLimit,
}: {
  label: string;
  current: number;
  limit: number;
  description?: string;
  atLimit?: boolean;
}) {
  const pct = Math.min(100, limit > 0 ? (current / limit) * 100 : 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{label}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span>
            <span className="font-semibold">{current}</span>
            <span className="text-muted-foreground"> / {limit}</span>
          </span>
          {atLimit ? (
            <span className="text-destructive font-medium">At limit</span>
          ) : (
            <span className="text-muted-foreground">Room available</span>
          )}
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={current}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-label={label}
        >
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

function UsageMonitor({ data }: { data: SubscriptionDetailsDTO }) {
  return (
    <UsageBar
      label="Client usage"
      current={data.currentClientCount}
      limit={data.clientLimit}
      description="Active clients linked to your practice versus your plan limit."
      atLimit={!data.canAddClient}
    />
  );
}

function EnterpriseContactSalesCard() {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card/50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{TIER_LABEL.ENTERPRISE}</h3>
        <Badge
          variant="outline"
          className="shrink-0 text-[0.65rem] font-semibold normal-case tracking-normal"
        >
          Sales only
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Up to {TIER_LIMITS.ENTERPRISE} firm clients
      </p>
      <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">
        Custom pricing
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Multi-advisor firms with shared branding and custom contracts.
      </p>
      <div className="mt-auto flex min-h-10 items-end pt-4">
        <EnterpriseSalesContactDialog />
      </div>
    </div>
  );
}

type CommittedPlan = { tier: SubscriptionTier; billingCycle: BillingCycle };

function PlanSelector({
  billingCycle,
  onBillingCycleChange,
  onSelectPlan,
  busy,
  error,
  planPrices,
  changePlanMode,
  committedPlan,
  subscriptionStatus,
  debugBilling,
}: {
  billingCycle: BillingCycle;
  onBillingCycleChange: (c: BillingCycle) => void;
  onSelectPlan: (tier: SubscriptionTier) => void;
  busy: boolean;
  error: string | null;
  planPrices: PlanPricesForUi;
  changePlanMode: "checkout" | "stripe_update";
  committedPlan: CommittedPlan | null;
  subscriptionStatus: string;
  debugBilling: boolean;
}) {
  const awaitingCheckoutOnly =
    changePlanMode === "checkout" &&
    committedPlan !== null &&
    subscriptionStatus !== "CANCELLED" &&
    subscriptionStatus !== "NONE";

  const description =
    changePlanMode === "stripe_update"
      ? "Higher tiers show Upgrade. Your active tier and interval is marked Current plan and is not selectable. Use other cards to change tier or monthly/annual billing (Stripe proration). Download receipts below or in Manage billing."
      : awaitingCheckoutOnly
        ? `You have a plan on file (${TIER_LABEL[committedPlan!.tier]}, ${committedPlan!.billingCycle === "ANNUAL" ? "annual" : "monthly"} billing) but payment is not linked yet. Pick any tier or interval, then complete Checkout—you can downgrade before paying.`
        : "Choose a tier and billing interval. You will complete payment securely on Stripe Checkout.";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Plans</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant={billingCycle === "MONTHLY" ? "default" : "outline"}
            onClick={() => onBillingCycleChange("MONTHLY")}
          >
            Monthly
          </Button>
          <Button
            type="button"
            size="sm"
            variant={billingCycle === "ANNUAL" ? "default" : "outline"}
            onClick={() => onBillingCycleChange("ANNUAL")}
          >
            Annual (1 month free)
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const hasCommitted = committedPlan !== null;
          const isSameTier = hasCommitted && tier === committedPlan!.tier;
          const isSamePlan =
            hasCommitted &&
            tier === committedPlan!.tier &&
            billingCycle === committedPlan!.billingCycle;
          const committedRank = hasCommitted ? TIER_RANK[committedPlan!.tier] : -1;
          const tierRank = TIER_RANK[tier];

          const isCurrentSelection =
            changePlanMode === "stripe_update" && isSamePlan;

          let buttonLabel = "Subscribe";
          if (isSamePlan && awaitingCheckoutOnly) {
            buttonLabel = "Add payment in Stripe";
          } else if (isSamePlan && subscriptionStatus === "CANCELLED") {
            buttonLabel = "Resubscribe";
          } else if (hasCommitted && isSameTier && !isSamePlan) {
            buttonLabel = "Switch billing";
          } else if (hasCommitted && tierRank > committedRank) {
            buttonLabel = "Upgrade";
          } else if (hasCommitted && tierRank < committedRank) {
            buttonLabel = "Downgrade";
          }

          const planButtonVariant: "billingUpgrade" | "billingDowngrade" | "default" = (() => {
            if (hasCommitted && tierRank > committedRank) {
              return "billingUpgrade";
            }
            if (hasCommitted && tierRank < committedRank) {
              return "billingDowngrade";
            }
            return "default";
          })();

          const disabled = busy;

          const busyLabel =
            changePlanMode === "stripe_update" ? "Updating…" : "Redirecting…";

          if (debugBilling) {
            const whyNotCurrent: string[] = [];
            if (changePlanMode !== "stripe_update") {
              whyNotCurrent.push(
                `changePlanMode is "${changePlanMode}" (isCurrentSelection only when "stripe_update")`
              );
            }
            if (!hasCommitted) {
              whyNotCurrent.push("no committedPlan (subscription status is NONE)");
            } else if (tier !== committedPlan!.tier) {
              whyNotCurrent.push(`tier mismatch: card=${tier} committed=${committedPlan!.tier}`);
            } else if (billingCycle !== committedPlan!.billingCycle) {
              whyNotCurrent.push(
                `billing interval mismatch: uiCycle=${billingCycle} committedCycle=${committedPlan!.billingCycle} (toggle Monthly/Annual above)`
              );
            }
            console.debug("[advisor-billing] plan-card", {
              tier,
              uiBillingCycle: billingCycle,
              changePlanMode,
              subscriptionStatus,
              committedPlan,
              hasCommitted,
              isSameTier,
              isSamePlan,
              isCurrentSelection,
              awaitingCheckoutOnly,
              buttonLabel,
              planButtonVariant,
              showsNonSelectableCurrentBlock: isCurrentSelection,
              whyNotCurrent: isCurrentSelection ? [] : whyNotCurrent,
            });
          }

          const priceLine =
            billingCycle === "MONTHLY"
              ? planPrices[tier].monthly
              : planPrices[tier].annual;

          return (
            <div
              key={tier}
              className={cn(
                "flex h-full flex-col rounded-lg border bg-card/50 p-4 shadow-sm",
                isCurrentSelection &&
                  "border-primary/35 bg-muted/25 ring-1 ring-primary/25 shadow-none"
              )}
              aria-current={isCurrentSelection ? "true" : undefined}
            >
              <div className="space-y-2">
                <h3 className="font-semibold">{TIER_LABEL[tier]}</h3>
                {isCurrentSelection ? (
                  <Badge
                    variant="secondary"
                    className="w-fit text-[0.65rem] font-semibold normal-case tracking-normal"
                  >
                    Current plan
                  </Badge>
                ) : isSameTier &&
                  hasCommitted &&
                  changePlanMode === "stripe_update" &&
                  !isSamePlan ? (
                  <Badge
                    variant="outline"
                    className="w-fit text-[0.65rem] font-semibold normal-case tracking-normal"
                  >
                    Other interval
                  </Badge>
                ) : isSameTier && hasCommitted && awaitingCheckoutOnly ? (
                  <span className="inline-flex w-fit rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Your plan
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Up to {TIER_LIMITS[tier]} clients
              </p>
              {priceLine ? (
                <p className="mt-3 text-lg font-semibold tabular-nums tracking-tight">
                  {priceLine}
                </p>
              ) : (
                <p className="mt-3 text-lg font-semibold tracking-tight text-muted-foreground">
                  Price unavailable
                </p>
              )}
              <div className="mt-auto flex min-h-10 items-end pt-4">
                {isCurrentSelection ? (
                  <div className="w-full rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Your current plan. Pick another tier or switch monthly/annual above to change.
                    </p>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    type="button"
                    variant={planButtonVariant}
                    disabled={disabled}
                    onClick={() => onSelectPlan(tier)}
                  >
                    {busy ? busyLabel : buttonLabel}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        <EnterpriseContactSalesCard />
      </CardContent>
      {error ? (
        <CardFooter>
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        </CardFooter>
      ) : null}
    </Card>
  );
}

function BillingHistory({
  invoices,
  canUseBillingPortal,
}: {
  invoices: BillingInvoiceDTO[];
  canUseBillingPortal: boolean;
}) {
  if (invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Invoices & receipts</CardTitle>
          <CardDescription>
            {canUseBillingPortal
              ? "Nothing listed here yet. Use Manage billing & receipts above for the Stripe customer portal—full invoice history and PDF downloads."
              : "No invoices yet. They will appear after your first payment."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Invoices & receipts</CardTitle>
        <CardDescription>
          Download hosted invoices or PDFs. For older documents, use Manage billing & receipts.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-4 font-medium">Date</th>
              <th className="pb-2 pr-4 font-medium">Invoice</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 font-medium">Amount</th>
              <th className="pb-2 pl-4 font-medium">Download</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border/60">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {new Date(inv.created).toLocaleDateString()}
                </td>
                <td className="py-2 pr-4">{inv.number ?? inv.id.slice(0, 12)}</td>
                <td className="py-2 pr-4 capitalize">{inv.status ?? "—"}</td>
                <td className="py-2 whitespace-nowrap">
                  {formatMoney(inv.amountPaid, inv.currency)}
                </td>
                <td className="py-2 pl-4">
                  {inv.hostedUrl ? (
                    <a
                      href={inv.hostedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      Invoice page
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                    </a>
                  ) : inv.pdfUrl ? (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      PDF
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function humanizePaymentMethod(method: EnterpriseBillingSummary["paymentMethod"]) {
  return method === "CARD" ? "Credit card (Stripe)" : "Wire transfer";
}

export function EnterpriseBillingDashboard({
  enterprise,
  initialInvoices,
  billingEnabled,
}: {
  enterprise: EnterpriseBillingSummary;
  initialInvoices: BillingInvoiceDTO[];
  billingEnabled: boolean;
}) {
  const [portalError, setPortalError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const periodEnd = new Date(enterprise.currentPeriodEnd);
  const seatOverage = enterprise.seatOverage > 0;
  const isOwner = enterprise.role === "OWNER";

  const onPortal = useCallback(() => {
    setPortalError(null);
    startTransition(async () => {
      const res = await createPortalSession();
      if (!res.success) {
        setPortalError(res.error);
        return;
      }
      if (!res.url?.trim()) {
        setPortalError("Portal did not return a valid link.");
        return;
      }
      window.location.href = res.url;
    });
  }, []);

  if (!billingEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Billing features are turned off for this environment.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {enterprise.enterpriseName} · Enterprise plan (sales-assisted)
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            Plan changes require contacting your account manager. Usage below reflects firm-wide
            limits and your assigned clients.
          </p>
        </div>
        {enterprise.canManageStripePortal ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={onPortal}
            className="shrink-0"
          >
            Manage billing & receipts
          </Button>
        ) : null}
      </div>

      {portalError ? (
        <p className="text-sm text-destructive" role="alert">
          {portalError}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" aria-hidden />
            Firm subscription
          </CardTitle>
          <CardDescription>
            {isOwner
              ? "Your firm’s Enterprise contract and payment method."
              : "Read-only summary — only the firm owner can open the Stripe billing portal."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">Enterprise</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">{enterprise.status.replace(/_/g, " ")}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">Billing</span>
            <span className="font-medium">
              {enterprise.billingCycle === "ANNUAL" ? "Annual" : "Monthly"}
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">Payment method</span>
            <span className="font-medium">{humanizePaymentMethod(enterprise.paymentMethod)}</span>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-muted-foreground">Current period ends</span>
            <span className="font-medium">{periodEnd.toLocaleDateString()}</span>
          </div>
          {enterprise.paymentMethod === "WIRE" ? (
            <p className="pt-2 text-muted-foreground">
              This firm is billed by wire transfer. Contact your account manager for invoices or
              contract changes.
            </p>
          ) : null}
          {enterprise.cancelAtPeriodEnd ? (
            <p className="text-amber-600 dark:text-amber-500 pt-2">
              Your subscription is set to cancel at the end of this billing period.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <UsageBar
          label="Firm client usage"
          current={enterprise.firmClientCount}
          limit={enterprise.firmClientLimit}
          description="Distinct clients with active assignments across your firm."
          atLimit={enterprise.firmClientCount >= enterprise.firmClientLimit}
        />
        <UsageBar
          label="Your assigned clients"
          current={enterprise.advisorClientCount}
          limit={enterprise.perAdvisorClientLimit}
          description={`Each advisor may have up to ${enterprise.perAdvisorClientLimit} assigned clients.`}
          atLimit={!enterprise.canAddClient}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Advisor seats</CardTitle>
          <CardDescription>
            Active team logins versus your contracted seat package. Overage is reported but not
            blocked in v1.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Badge variant={seatOverage ? "warning" : "secondary"}>
            {enterprise.activeSeats} / {enterprise.seatLimit} seats
          </Badge>
          {seatOverage ? (
            <Badge variant="outline">Over limit by {enterprise.seatOverage}</Badge>
          ) : null}
        </CardContent>
      </Card>

      <BillingHistory
        invoices={initialInvoices}
        canUseBillingPortal={enterprise.canManageStripePortal}
      />
    </div>
  );
}

export function BillingDashboard({
  initialSubscription,
  initialInvoices,
  checkoutNotice,
  subscriptionRequiredNotice = false,
  billingEnabled,
  planPrices,
  debugBilling = isAdvisorBillingDebugEnabled(),
}: {
  initialSubscription: SubscriptionDetailsDTO | null;
  initialInvoices: BillingInvoiceDTO[];
  checkoutNotice: "success" | "cancel" | null;
  subscriptionRequiredNotice?: boolean;
  billingEnabled: boolean;
  planPrices: PlanPricesForUi;
  /** Prefer pass-through from server page; falls back to env gate when omitted (e.g. Storybook). */
  debugBilling?: boolean;
}) {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(() => {
    const sub = initialSubscription;
    if (sub && sub.status !== "NONE" && sub.status !== "CANCELLED") {
      return sub.billingCycle;
    }
    return "MONTHLY";
  });
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const data =
    initialSubscription ??
    ({
      tier: "STARTER",
      status: "NONE",
      clientLimit: TIER_LIMITS.STARTER,
      billingCycle: "MONTHLY",
      currentPeriodEnd: new Date().toISOString(),
      cancelAtPeriodEnd: false,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentClientCount: 0,
      canAddClient: true,
    } satisfies SubscriptionDetailsDTO);

  /** After Checkout redirect, the DB updates via webhook — poll RSC until Stripe ids land, then drop ?checkout=success. */
  useEffect(() => {
    if (checkoutNotice !== "success") return;

    if (data.stripeSubscriptionId?.trim()) {
      router.replace("/advisor/billing", { scroll: false });
      return;
    }

    const interval = setInterval(() => {
      router.refresh();
    }, 2500);
    const maxWait = setTimeout(() => clearInterval(interval), 90_000);

    return () => {
      clearInterval(interval);
      clearTimeout(maxWait);
    };
  }, [checkoutNotice, data.stripeSubscriptionId, router]);

  const changePlanMode: "checkout" | "stripe_update" =
    Boolean(data.stripeSubscriptionId) && data.status !== "CANCELLED"
      ? "stripe_update"
      : "checkout";

  const committedPlan: CommittedPlan | null = useMemo(
    () =>
      data.status === "NONE" ? null : { tier: data.tier, billingCycle: data.billingCycle },
    [data.status, data.tier, data.billingCycle]
  );

  useEffect(() => {
    if (!debugBilling) return;
    const raw = initialSubscription;
    console.debug("[advisor-billing] BillingDashboard render snapshot", {
      checkoutNotice,
      rawInitialSubscription: raw
        ? {
            tier: raw.tier,
            status: raw.status,
            billingCycle: raw.billingCycle,
            clientLimit: raw.clientLimit,
            currentPeriodEnd: raw.currentPeriodEnd,
            cancelAtPeriodEnd: raw.cancelAtPeriodEnd,
            stripeCustomerId: raw.stripeCustomerId,
            stripeSubscriptionId: raw.stripeSubscriptionId,
            currentClientCount: raw.currentClientCount,
            canAddClient: raw.canAddClient,
          }
        : null,
      resolvedDashboardData: {
        tier: data.tier,
        status: data.status,
        billingCycle: data.billingCycle,
        stripeCustomerId: data.stripeCustomerId,
        stripeSubscriptionId: data.stripeSubscriptionId,
      },
      uiBillingCycle: billingCycle,
      changePlanMode,
      committedPlan,
      uiVsCommittedCycle: committedPlan
        ? { matches: billingCycle === committedPlan.billingCycle, ui: billingCycle, committed: committedPlan.billingCycle }
        : { matches: null, ui: billingCycle, committed: null },
      stripeUpdateReason: {
        hasStripeSubscriptionId: Boolean(data.stripeSubscriptionId?.trim()),
        statusIsCancelled: data.status === "CANCELLED",
      },
    });
  }, [
    debugBilling,
    checkoutNotice,
    initialSubscription,
    data.tier,
    data.status,
    data.billingCycle,
    data.stripeCustomerId,
    data.stripeSubscriptionId,
    data.clientLimit,
    data.currentPeriodEnd,
    data.cancelAtPeriodEnd,
    data.currentClientCount,
    data.canAddClient,
    billingCycle,
    changePlanMode,
    committedPlan,
  ]);

  const onSelectPlan = useCallback(
    (tier: SubscriptionTier) => {
      setCheckoutError(null);
      startTransition(async () => {
        if (changePlanMode === "stripe_update") {
          const res = await switchSubscriptionPlan({ tier, billingCycle });
          if (!res.success) {
            setCheckoutError(res.error);
            return;
          }
          router.refresh();
          return;
        }
        const res = await createCheckoutSession({ tier, billingCycle });
        if (!res.success) {
          setCheckoutError(res.error);
          return;
        }
        if (!res.url?.trim()) {
          setCheckoutError("Checkout did not return a valid link. Try again or contact support.");
          return;
        }
        try {
          new URL(res.url);
        } catch {
          setCheckoutError("Checkout link was invalid. Check AUTH_URL in production.");
          return;
        }
        window.location.href = res.url;
      });
    },
    [billingCycle, changePlanMode, router]
  );

  const onPortal = useCallback(() => {
    setCheckoutError(null);
    startTransition(async () => {
      const res = await createPortalSession();
      if (!res.success) {
        setCheckoutError(res.error);
        return;
      }
      if (!res.url?.trim()) {
        setCheckoutError("Portal did not return a valid link.");
        return;
      }
      try {
        new URL(res.url);
      } catch {
        setCheckoutError("Portal link was invalid.");
        return;
      }
      window.location.href = res.url;
    });
  }, []);

  if (!billingEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
          <CardDescription>
            Billing features are turned off for this environment (
            <code className="text-xs">ENABLE_BILLING_FEATURES=false</code>).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {subscriptionRequiredNotice ? (
        <Alert variant="warning">
          <AlertCircle className="size-4" />
          <AlertTitle>Subscription required</AlertTitle>
          <AlertDescription>
            Your trial or grace period has ended, so advisor hub pages are paused until you
            subscribe. Choose a plan below to complete checkout and restore access to your
            pipeline, clients, and reports.
          </AlertDescription>
        </Alert>
      ) : null}
      {checkoutNotice === "success" ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          Checkout completed. This page refreshes automatically until your subscription appears
          (usually a few seconds after Stripe confirms payment).
        </div>
      ) : null}
      {checkoutNotice === "cancel" ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Checkout was canceled. No changes were made.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        {data.stripeCustomerId ? (
          <>
            <p className="max-w-prose text-sm text-muted-foreground">
              Open the Stripe customer portal to update cards, cancel, or download full invoice
              history. Use the plan grid below to upgrade, downgrade, or switch monthly/annual
              billing.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onPortal}
              className="shrink-0"
            >
              Manage billing & receipts
            </Button>
          </>
        ) : (
          <p className="max-w-prose text-sm text-muted-foreground">
            Complete checkout on a plan below, then return here for receipts and billing portal
            access.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SubscriptionOverview data={data} />
        <UsageMonitor data={data} />
      </div>

      <PlanSelector
        billingCycle={billingCycle}
        onBillingCycleChange={setBillingCycle}
        onSelectPlan={onSelectPlan}
        busy={pending}
        error={checkoutError}
        planPrices={planPrices}
        changePlanMode={changePlanMode}
        committedPlan={committedPlan}
        subscriptionStatus={data.status}
        debugBilling={debugBilling}
      />

      <BillingHistory
        invoices={initialInvoices}
        canUseBillingPortal={Boolean(data.stripeCustomerId?.trim())}
      />
    </div>
  );
}
