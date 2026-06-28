"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { billingPlanNavigationLabel } from "@/lib/billing/billing-plan-cta";
import { ANNUAL_BILLING_SAVINGS_LABEL, TIER_LIMITS } from "@/lib/billing/constants";
import {
  ADVISOR_PIPELINE_HREF,
  analyzeDowngradeCapacity,
  clientLimitBillingHref,
  clientLimitUpgradeMessage,
  clientsOverTierCapacity,
  downgradeCapacityBannerMessage,
  suggestedTierForMoreClients,
  type ClientLimitSnapshot,
  type DowngradeCapacityStatus,
} from "@/lib/billing/client-limit";
import {
  buildPlanChangeExplainer,
  shouldConfirmPlanChange,
} from "@/lib/billing/plan-change-explainer";
import {
  SELF_SERVE_TIERS,
  TIER_CATALOG,
  TIER_DISPLAY_NAME,
  TIER_RANK,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";
import { PlanTierFeatureList } from "@/components/billing/PlanTierFeatureList";
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
import { PlanChangeConfirmDialog } from "@/components/advisor/billing/PlanChangeConfirmDialog";

const TIER_ORDER = SELF_SERVE_TIERS;

const TIER_LABEL = TIER_DISPLAY_NAME;

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
  currentTier,
}: {
  label: string;
  current: number;
  limit: number;
  description?: string;
  atLimit?: boolean;
  currentTier?: SubscriptionTier;
}) {
  const pct = Math.min(100, limit > 0 ? (current / limit) * 100 : 0);
  const upgradeStatus: ClientLimitSnapshot | null =
    atLimit && currentTier
      ? {
          canAddClient: false,
          currentCount: current,
          limit,
          currentTier,
          suggestedUpgradeTier: suggestedTierForMoreClients(currentTier),
          isEnterprise: false,
          canSelfServeUpgrade: true,
        }
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {label}
          {atLimit ? <Lock className="size-4 text-destructive" aria-hidden /> : null}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span>
            <span className="font-semibold">{current}</span>
            <span className="text-muted-foreground"> / {limit}</span>
          </span>
          {atLimit ? (
            <span className="font-medium text-destructive">At limit</span>
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
          <div
            className={cn("h-full transition-all", atLimit ? "bg-destructive" : "bg-primary")}
            style={{ width: `${pct}%` }}
          />
        </div>
        {upgradeStatus ? (
          <div className="space-y-3 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm text-muted-foreground">
              {clientLimitUpgradeMessage(upgradeStatus)}
            </p>
            {upgradeStatus.suggestedUpgradeTier ? (
              <Button asChild size="sm" variant="outline">
                <Link href={clientLimitBillingHref(upgradeStatus)}>
                  {billingPlanNavigationLabel(upgradeStatus.suggestedUpgradeTier)}
                </Link>
              </Button>
            ) : (
              <EnterpriseSalesContactDialog />
            )}
          </div>
        ) : null}
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
      currentTier={data.tier}
    />
  );
}

function DowngradeCapacityBanner({ status }: { status: DowngradeCapacityStatus }) {
  const message = downgradeCapacityBannerMessage(status);
  if (!message) return null;

  return (
    <Alert variant="warning">
      <AlertCircle className="size-4" />
      <AlertTitle>Downgrade requires fewer active clients</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message}</p>
        <Button asChild size="sm" variant="outline">
          <Link href={ADVISOR_PIPELINE_HREF}>Open Pipeline</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function EnterpriseContactSalesCard() {
  return (
    <section
      className="mt-2 flex flex-col gap-4 rounded-[1.25rem] border border-border/70 bg-muted/15 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
      aria-labelledby="billing-enterprise-heading"
    >
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 id="billing-enterprise-heading" className="font-semibold text-foreground">
            {TIER_LABEL.ENTERPRISE}
          </h3>
          <Badge
            variant="outline"
            className="text-[0.65rem] font-semibold normal-case tracking-normal"
          >
            Firms
          </Badge>
        </div>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          Same Essentials–Platinum modules with shared branding, multiple advisor seats, and
          centralized billing. Talk to sales for firm pricing.
        </p>
      </div>
      <div className="shrink-0">
        <EnterpriseSalesContactDialog />
      </div>
    </section>
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
  currentClientCount,
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
  currentClientCount: number;
  debugBilling: boolean;
}) {
  const awaitingCheckoutOnly =
    changePlanMode === "checkout" &&
    committedPlan !== null &&
    subscriptionStatus !== "CANCELLED" &&
    subscriptionStatus !== "NONE";

  const description =
    changePlanMode === "stripe_update"
      ? "Your active plan is highlighted. Change tier or billing interval below—Stripe applies proration on upgrades and downgrades. To downgrade, active clients must fit the new plan limit—end workflows in Pipeline first."
      : awaitingCheckoutOnly
        ? `Plan on file: ${TIER_LABEL[committedPlan!.tier]} (${committedPlan!.billingCycle === "ANNUAL" ? "annual" : "monthly"}). Complete checkout to activate, or pick a different tier first.`
        : "Choose a tier and billing interval, then complete payment on Stripe Checkout.";

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="space-y-1.5">
          <CardTitle className="text-lg">Plans</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div
          className="inline-flex w-fit rounded-full border border-border/80 bg-card/90 p-1 shadow-sm"
          role="group"
          aria-label="Billing interval"
        >
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              billingCycle === "MONTHLY"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onBillingCycleChange("MONTHLY")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              billingCycle === "ANNUAL"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onBillingCycleChange("ANNUAL")}
          >
            Annual
            <span className="ml-1.5 text-xs font-semibold text-brand">
              {ANNUAL_BILLING_SAVINGS_LABEL}
            </span>
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const catalog = TIER_CATALOG[tier];
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

          const isSameTierBillingSwitch =
            hasCommitted && isSameTier && !isSamePlan;

          const capacityBlocked =
            !isSamePlan &&
            currentClientCount > TIER_LIMITS[tier];

          const capacityActionLabel =
            hasCommitted && tierRank < committedRank
              ? "downgrading"
              : isSameTierBillingSwitch
                ? "switching billing"
                : "selecting this plan";

          const disabled = busy || capacityBlocked;

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
            <article
              key={tier}
              className={cn(
                "flex h-full flex-col rounded-[1.25rem] border bg-card/85 p-5 shadow-sm",
                isCurrentSelection
                  ? "border-primary/35 ring-1 ring-primary/20"
                  : "border-border/70"
              )}
              aria-current={isCurrentSelection ? "true" : undefined}
            >
              <div className="mb-3 flex h-6 items-center">
                {isCurrentSelection ? (
                  <Badge
                    variant="secondary"
                    className="text-[0.65rem] font-semibold normal-case tracking-normal"
                  >
                    Current plan
                  </Badge>
                ) : isSameTier &&
                  hasCommitted &&
                  changePlanMode === "stripe_update" &&
                  !isSamePlan ? (
                  <Badge
                    variant="outline"
                    className="text-[0.65rem] font-semibold normal-case tracking-normal"
                  >
                    Other interval
                  </Badge>
                ) : isSameTier && hasCommitted && awaitingCheckoutOnly ? (
                  <Badge
                    variant="outline"
                    className="text-[0.65rem] font-semibold normal-case tracking-normal"
                  >
                    Your plan
                  </Badge>
                ) : null}
              </div>

              <h3 className="font-display text-lg font-semibold leading-tight text-foreground">
                {TIER_LABEL[tier]}
              </h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                {catalog.tagline}
              </p>
              <p className="mt-2 text-xs font-medium uppercase leading-5 tracking-wide text-muted-foreground">
                {catalog.modules}
              </p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">
                Up to {TIER_LIMITS[tier]} active clients
              </p>

              <div className="mt-4 min-h-[3.25rem]">
                {priceLine ? (
                  <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                    {priceLine}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-muted-foreground">Price unavailable</p>
                )}
              </div>

              <PlanTierFeatureList
                tier={tier}
                variant="compact"
                className="mt-4 flex-1 border-t border-border/60 pt-4"
              />

              <div className="mt-auto space-y-2 pt-4">
                {isCurrentSelection ? (
                  <Button
                    type="button"
                    className="w-full"
                    variant="billingCurrent"
                    disabled
                    aria-disabled
                  >
                    Current plan
                  </Button>
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
                {capacityBlocked ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {currentClientCount} active clients exceed the {TIER_LIMITS[tier]}-client cap.
                    End workflows in{" "}
                    <Link href={ADVISOR_PIPELINE_HREF} className="font-medium text-primary hover:underline">
                      Pipeline
                    </Link>{" "}
                    before {capacityActionLabel}.
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
        </div>
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
  const needsCardCheckout =
    isOwner &&
    enterprise.paymentMethod === "CARD" &&
    !enterprise.stripeSubscriptionId?.trim();
  const planLabel =
    TIER_DISPLAY_NAME[enterprise.tier] ?? enterprise.tier.replace(/_/g, " ");

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
            {enterprise.enterpriseName} · {planLabel} module tier
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            {needsCardCheckout
              ? "Your agreement is in place. Choose a module tier and complete checkout to activate firm billing."
              : "Firm-wide usage, seats, and payment method. Plan changes after activation require your account manager."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {needsCardCheckout ? (
            <Button asChild className="shrink-0">
              <Link href="/advisor/enterprise/pricing">Choose plan & subscribe</Link>
            </Button>
          ) : null}
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
            <span className="font-medium">{planLabel}</span>
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
  checkoutPlanIntent = null,
}: {
  initialSubscription: SubscriptionDetailsDTO | null;
  initialInvoices: BillingInvoiceDTO[];
  checkoutNotice: "success" | "cancel" | null;
  subscriptionRequiredNotice?: boolean;
  billingEnabled: boolean;
  planPrices: PlanPricesForUi;
  /** Prefer pass-through from server page; falls back to env gate when omitted (e.g. Storybook). */
  debugBilling?: boolean;
  checkoutPlanIntent?: { tier: SelfServeTier; billingCycle: BillingCycle } | null;
}) {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(() => {
    if (checkoutPlanIntent?.billingCycle) {
      return checkoutPlanIntent.billingCycle;
    }
    const sub = initialSubscription;
    if (sub && sub.status !== "NONE" && sub.status !== "CANCELLED") {
      return sub.billingCycle;
    }
    return "MONTHLY";
  });
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingPlanTier, setPendingPlanTier] = useState<SelfServeTier | null>(null);
  const [planChangeDialogOpen, setPlanChangeDialogOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const data =
    initialSubscription ??
    ({
      tier: "ESSENTIALS",
      status: "NONE",
      clientLimit: TIER_LIMITS.ESSENTIALS,
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

  const downgradeCapacity = useMemo(() => {
    if (data.status === "NONE" || data.status === "CANCELLED") return null;
    return analyzeDowngradeCapacity({
      currentTier: data.tier,
      currentClientCount: data.currentClientCount,
    });
  }, [data.status, data.tier, data.currentClientCount]);

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

  const executePlanChange = useCallback(
    (tier: SelfServeTier) => {
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
    [billingCycle, changePlanMode, router],
  );

  const requestPlanChange = useCallback(
    (tier: SubscriptionTier) => {
      const selfServeTier = tier as SelfServeTier;
      const input = {
        targetTier: selfServeTier,
        targetBillingCycle: billingCycle,
        committedPlan,
        changePlanMode,
        subscriptionStatus: data.status,
        currentClientCount: data.currentClientCount,
      };
      if (shouldConfirmPlanChange(input)) {
        setPendingPlanTier(selfServeTier);
        setPlanChangeDialogOpen(true);
        return;
      }
      executePlanChange(selfServeTier);
    },
    [
      billingCycle,
      changePlanMode,
      committedPlan,
      data.currentClientCount,
      data.status,
      executePlanChange,
    ],
  );

  const planChangeExplainer = useMemo(() => {
    if (!pendingPlanTier) return null;
    return buildPlanChangeExplainer({
      targetTier: pendingPlanTier,
      targetBillingCycle: billingCycle,
      committedPlan,
      changePlanMode,
      subscriptionStatus: data.status,
      currentClientCount: data.currentClientCount,
    });
  }, [
    pendingPlanTier,
    billingCycle,
    committedPlan,
    changePlanMode,
    data.status,
    data.currentClientCount,
  ]);

  const planChangeConfirmDisabled = pendingPlanTier
    ? clientsOverTierCapacity(data.currentClientCount, pendingPlanTier) > 0
    : false;

  const onConfirmPlanChange = useCallback(() => {
    if (!pendingPlanTier) return;
    const tier = pendingPlanTier;
    setPlanChangeDialogOpen(false);
    setPendingPlanTier(null);
    executePlanChange(tier);
  }, [executePlanChange, pendingPlanTier]);

  const onSelectPlan = requestPlanChange;

  const checkoutIntentStarted = useRef(false);

  useEffect(() => {
    if (!checkoutPlanIntent || !billingEnabled || checkoutIntentStarted.current) return;
    checkoutIntentStarted.current = true;
    if (changePlanMode === "stripe_update") {
      router.replace("/advisor/billing", { scroll: false });
      return;
    }
    onSelectPlan(checkoutPlanIntent.tier);
    router.replace("/advisor/billing", { scroll: false });
  }, [billingEnabled, changePlanMode, checkoutPlanIntent, onSelectPlan, router]);

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

      {downgradeCapacity?.showBanner ? (
        <DowngradeCapacityBanner status={downgradeCapacity} />
      ) : null}

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
        currentClientCount={data.currentClientCount}
        debugBilling={debugBilling}
      />

      <BillingHistory
        invoices={initialInvoices}
        canUseBillingPortal={Boolean(data.stripeCustomerId?.trim())}
      />

      <PlanChangeConfirmDialog
        explainer={planChangeExplainer}
        open={planChangeDialogOpen}
        onOpenChange={(open) => {
          setPlanChangeDialogOpen(open);
          if (!open) setPendingPlanTier(null);
        }}
        onConfirm={onConfirmPlanChange}
        pending={pending}
        confirmDisabled={planChangeConfirmDisabled}
      />
    </div>
  );
}
