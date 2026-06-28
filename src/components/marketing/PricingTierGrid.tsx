"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowRight, Building2, Check, Loader2, Sparkles } from "lucide-react";
import type { BillingCycle } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  createCheckoutSession,
  createEnterpriseCheckoutSession,
  switchSubscriptionPlan,
} from "@/lib/actions/billing";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { ANNUAL_BILLING_SAVINGS_LABEL } from "@/lib/billing/constants";
import { ADVISOR_PIPELINE_HREF, clientsOverTierCapacity } from "@/lib/billing/client-limit";
import {
  buildPlanChangeExplainer,
  shouldConfirmPlanChange,
} from "@/lib/billing/plan-change-explainer";
import {
  advisorBillingDeepLink,
  advisorSignupHref,
  enterprisePricingDeepLink,
  SELF_SERVE_TIERS,
  TIER_CATALOG,
  type SelfServeTier,
} from "@/lib/billing/tier-catalog";
import type { SubscriptionDetailsDTO } from "@/lib/actions/billing";
import {
  nextSelfServeTier,
  resolveCommittedPlan,
  resolvePricingPlanChangeMode,
  resolvePricingTierButtonLabel,
  resolvePricingTierButtonVariant,
  resolvePricingTierCapacityBlock,
} from "@/lib/marketing/pricing-tier-actions";
import type { PublicTierPricing } from "@/lib/billing/public-tier-pricing";
import type { EnterprisePricingFirmContext } from "@/lib/enterprise/pricing-page-access";
import {
  ENTERPRISE_PRICING_POINTS,
  SOLO_ADVISOR_PRICING_POINTS,
} from "@/lib/marketing/pricing-tiers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanTierFeatureList } from "@/components/billing/PlanTierFeatureList";
import { TierPricingConfigAlert } from "@/components/billing/TierPricingConfigAlert";
import { PlanChangeConfirmDialog } from "@/components/advisor/billing/PlanChangeConfirmDialog";
import { cn } from "@/lib/utils";

export type PricingAudience = "solo" | "enterprise";
export type PricingTierGridSurface = "marketing" | "billing";

type PricingTierGridProps = {
  pricing: PublicTierPricing[];
  configErrors?: string[];
  billingEnabled: boolean;
  canSubscribe: boolean;
  audience?: PricingAudience;
  firm?: EnterprisePricingFirmContext;
  checkoutPlanIntent?: { tier: SelfServeTier; billingCycle: BillingCycle } | null;
  advisorSubscription?: SubscriptionDetailsDTO | null;
  initialBillingCycle?: BillingCycle;
  /** Marketing pricing page (default) vs advisor billing dashboard embed. */
  surface?: PricingTierGridSurface;
  /** Controlled billing interval (used by billing dashboard). */
  billingCycle?: BillingCycle;
  onBillingCycleChange?: (cycle: BillingCycle) => void;
  /** When set, plan changes are handled by the parent (no confirm dialog in grid). */
  onRequestPlanChange?: (tier: SelfServeTier) => void;
  planChangePending?: boolean;
  planChangeError?: string | null;
  suppressPlanChangeDialog?: boolean;
  suppressCheckoutIntent?: boolean;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type TierPriceDisplay = {
  main: string;
  sub?: string;
  periodSuffix: string;
};

/** Fixed row heights so titles, prices, and dividers line up across all tier cards. */
const PRICING_CARD_LAYOUT = {
  badge: "flex h-7 shrink-0 items-center",
  tagline: "mt-2 min-h-12 shrink-0 text-sm leading-6 text-muted-foreground",
  modules:
    "mt-4 min-h-[3.75rem] shrink-0 text-xs font-medium uppercase leading-5 tracking-wide text-muted-foreground",
  clientLimit: "mt-1 min-h-5 shrink-0 text-sm leading-5 text-muted-foreground",
  priceBlock: "mt-4 min-h-[4.75rem] shrink-0",
  featureList: "mt-5 min-h-0 flex-1 border-t border-border/60 pt-5",
  action: "mt-auto shrink-0 pt-6",
  statusBadge:
    "inline-flex h-6 items-center px-2.5 py-0 text-[0.65rem] font-semibold normal-case tracking-normal",
  featuredBadge:
    "inline-flex h-6 items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0 text-[0.65rem] font-semibold uppercase tracking-wide text-brand",
} as const;

function priceForCycle(
  tierPricing: PublicTierPricing,
  cycle: BillingCycle,
  audience: PricingAudience,
  seatLimit?: number
): TierPriceDisplay | null {
  const perSeat =
    cycle === "MONTHLY" ? tierPricing.monthly : tierPricing.annual;
  if (!perSeat) return null;

  if (audience === "enterprise" && seatLimit && seatLimit > 1) {
    if (cycle === "MONTHLY") {
      const totalCents = perSeat.amountCents * seatLimit;
      return {
        main: formatMoney(totalCents, perSeat.currency),
        periodSuffix: "/mo firm",
        sub: `${perSeat.display} × ${seatLimit} advisor seats`,
      };
    }
    const annualTotalCents = perSeat.amountCents * seatLimit;
    const monthlyEquivalentCents = Math.round(annualTotalCents / 12);
    return {
      main: formatMoney(annualTotalCents, perSeat.currency),
      periodSuffix: "/yr firm",
      sub: `${formatMoney(monthlyEquivalentCents, perSeat.currency)}/mo firm equivalent (${perSeat.display} per seat × ${seatLimit})`,
    };
  }

  if (cycle === "MONTHLY") {
    return {
      main: perSeat.display,
      periodSuffix: audience === "solo" ? "/mo" : "/mo firm",
      sub: "Billed monthly",
    };
  }

  return {
    main: perSeat.display,
    periodSuffix: audience === "solo" ? "/yr" : "/yr firm",
    sub: perSeat.monthlyEquivalentDisplay
      ? `${perSeat.monthlyEquivalentDisplay}/mo equivalent`
      : "Billed annually",
  };
}

function PricingTierActionButton({
  tier,
  billingCycle,
  billingEnabled,
  canSubscribe,
  featured,
  audience,
  surface = "marketing",
  advisorSubscription,
  onRequestPlanChange,
  planChangePending,
  planChangeError,
  contractTierLocked = false,
  isContractedTier = false,
}: {
  tier: SelfServeTier;
  billingCycle: BillingCycle;
  billingEnabled: boolean;
  canSubscribe: boolean;
  featured?: boolean;
  audience: PricingAudience;
  surface?: PricingTierGridSurface;
  advisorSubscription?: SubscriptionDetailsDTO | null;
  onRequestPlanChange: (tier: SelfServeTier) => void;
  planChangePending: boolean;
  planChangeError: string | null;
  contractTierLocked?: boolean;
  isContractedTier?: boolean;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);

  const billingDestination =
    audience === "enterprise"
      ? enterprisePricingDeepLink(tier, billingCycle)
      : advisorBillingDeepLink(tier, billingCycle);

  const signInHref = buildSignInHref({
    callbackUrl: billingDestination,
    audience: "staff",
  });

  const signupHref =
    audience === "enterprise"
      ? signInHref
      : advisorSignupHref(tier, billingCycle);

  const sessionReady = status !== "loading";
  const isAdvisorSession =
    sessionReady &&
    session?.user != null &&
    isAdvisorHubNavRole(session.user.role);

  const changePlanMode = resolvePricingPlanChangeMode(advisorSubscription);
  const committedPlan = resolveCommittedPlan(advisorSubscription);
  const subscriptionStatus = advisorSubscription?.status ?? "NONE";
  const awaitingCheckoutOnly =
    changePlanMode === "checkout" &&
    committedPlan !== null &&
    subscriptionStatus !== "CANCELLED" &&
    subscriptionStatus !== "NONE";
  const hasCommitted = committedPlan !== null;
  const isSamePlan =
    hasCommitted &&
    tier === committedPlan.tier &&
    billingCycle === committedPlan.billingCycle;
  const isCurrentSelection = changePlanMode === "stripe_update" && isSamePlan;
  const nextTier =
    isCurrentSelection && committedPlan ? nextSelfServeTier(committedPlan.tier) : null;

  const onSoloAdvisorGetStarted = useCallback(() => {
    setError(null);
    router.push(billingDestination);
  }, [billingDestination, router]);

  const buttonLabel = resolvePricingTierButtonLabel({
    tier,
    billingCycle,
    committedPlan,
    subscriptionStatus,
    awaitingCheckoutOnly,
  });
  const planButtonVariant = resolvePricingTierButtonVariant({ tier, committedPlan });
  const currentClientCount = advisorSubscription?.currentClientCount ?? 0;
  const capacityBlock = resolvePricingTierCapacityBlock({
    tier,
    currentClientCount,
    committedPlan,
    billingCycle,
  });
  const busyLabel = changePlanMode === "stripe_update" ? "Updating…" : "Redirecting…";
  const displayError = error ?? planChangeError;
  const pending = planChangePending;

  if (!billingEnabled) {
    return (
      <Button asChild className="w-full" variant={featured ? "default" : "outline"}>
        <Link href={audience === "enterprise" ? "/contact?intent=enterprise" : "/contact?intent=demo"}>
          Request pricing
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Button>
    );
  }

  if (!sessionReady) {
    return (
      <Button className="w-full" variant={featured ? "default" : "outline"} disabled>
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading…
      </Button>
    );
  }

  if (surface === "billing" && isAdvisorSession) {
    if (isCurrentSelection) {
      return (
        <Button
          type="button"
          className="w-full"
          variant="billingCurrent"
          disabled
          aria-disabled
        >
          Current plan
        </Button>
      );
    }

    return (
      <div className="space-y-2">
        <Button
          type="button"
          className="w-full"
          variant={planButtonVariant}
          disabled={pending || capacityBlock.blocked}
          onClick={() => onRequestPlanChange(tier)}
        >
          {pending ? busyLabel : buttonLabel}
        </Button>
        {capacityBlock.blocked ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {capacityBlock.reason}{" "}
            <Link href={ADVISOR_PIPELINE_HREF} className="font-medium text-primary hover:underline">
              Open Pipeline
            </Link>
          </p>
        ) : null}
        {displayError ? (
          <p className="text-xs text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  if (audience === "solo" && isAdvisorSession && isCurrentSelection) {
    if (!nextTier) {
      return null;
    }

    return (
      <div className="space-y-2">
        <Button
          type="button"
          className="w-full"
          variant="billingUpgrade"
          disabled={pending}
          onClick={() => onRequestPlanChange(nextTier)}
        >
          {pending ? busyLabel : "Upgrade"}
        </Button>
        {displayError ? (
          <p className="text-xs text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  if (audience === "solo" && isAdvisorSession && changePlanMode === "stripe_update" && hasCommitted) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          className="w-full"
          variant={planButtonVariant}
          disabled={pending || capacityBlock.blocked}
          onClick={() => onRequestPlanChange(tier)}
        >
          {pending ? busyLabel : buttonLabel}
        </Button>
        {capacityBlock.blocked ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {capacityBlock.reason}{" "}
            <Link href={ADVISOR_PIPELINE_HREF} className="font-medium text-primary hover:underline">
              Open Pipeline
            </Link>
          </p>
        ) : null}
        {displayError ? (
          <p className="text-xs text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  if (audience === "solo" && isAdvisorSession) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          className="w-full"
          variant={featured ? "default" : "outline"}
          onClick={onSoloAdvisorGetStarted}
        >
          Get Started
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        {displayError ? (
          <p className="text-xs text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  if (!canSubscribe) {
    return (
      <div className="space-y-2">
        <Button asChild className="w-full" variant={featured ? "default" : "outline"}>
          <Link href={signupHref}>
            Get Started
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
        {displayError ? (
          <p className="text-xs text-destructive" role="alert">
            {displayError}
          </p>
        ) : null}
      </div>
    );
  }

  if (contractTierLocked) {
    return (
      <Button className="w-full" variant="outline" disabled>
        Not in your contract
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        variant={featured || isContractedTier ? "default" : "outline"}
        disabled={pending}
        onClick={() => onRequestPlanChange(tier)}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Redirecting…
          </>
        ) : (
          <>
            {isContractedTier && audience === "enterprise"
              ? "Complete checkout"
              : "Get Started"}
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </Button>
      {displayError ? (
        <p className="text-xs text-destructive" role="alert">
          {displayError}
        </p>
      ) : null}
    </div>
  );
}

export function PricingTierGrid({
  pricing,
  configErrors = [],
  billingEnabled,
  canSubscribe,
  audience = "solo",
  firm,
  checkoutPlanIntent = null,
  advisorSubscription = null,
  initialBillingCycle,
  surface = "marketing",
  billingCycle: controlledBillingCycle,
  onBillingCycleChange,
  onRequestPlanChange: externalRequestPlanChange,
  planChangePending: externalPlanChangePending,
  planChangeError: externalPlanChangeError,
  suppressPlanChangeDialog = false,
  suppressCheckoutIntent = false,
}: PricingTierGridProps) {
  const router = useRouter();
  const changePlanMode = resolvePricingPlanChangeMode(advisorSubscription);
  const committedPlan = resolveCommittedPlan(advisorSubscription);
  const contractedModuleTier =
    audience === "enterprise" &&
    firm?.currentModuleTier &&
    SELF_SERVE_TIERS.includes(firm.currentModuleTier as SelfServeTier)
      ? (firm.currentModuleTier as SelfServeTier)
      : null;
  const contractedBillingCycle =
    audience === "enterprise" &&
    (firm?.contractedBillingCycle === "MONTHLY" ||
      firm?.contractedBillingCycle === "ANNUAL")
      ? firm.contractedBillingCycle
      : null;
  const billingCycleLocked = Boolean(contractedBillingCycle);

  const [internalBillingCycle, setInternalBillingCycle] = useState<BillingCycle>(() => {
    if (controlledBillingCycle) {
      return controlledBillingCycle;
    }
    if (checkoutPlanIntent?.billingCycle) {
      return checkoutPlanIntent.billingCycle;
    }
    if (contractedBillingCycle) {
      return contractedBillingCycle;
    }
    if (initialBillingCycle) {
      return initialBillingCycle;
    }
    if (
      advisorSubscription &&
      advisorSubscription.status !== "NONE" &&
      advisorSubscription.status !== "CANCELLED"
    ) {
      return advisorSubscription.billingCycle;
    }
    return "MONTHLY";
  });
  const billingCycle = controlledBillingCycle ?? internalBillingCycle;
  const handleBillingCycleChange = useCallback(
    (cycle: BillingCycle) => {
      if (controlledBillingCycle === undefined) {
        setInternalBillingCycle(cycle);
      }
      onBillingCycleChange?.(cycle);
    },
    [controlledBillingCycle, onBillingCycleChange],
  );
  const checkoutStarted = useRef(false);
  const [pendingPlanTier, setPendingPlanTier] = useState<SelfServeTier | null>(null);
  const [planChangeDialogOpen, setPlanChangeDialogOpen] = useState(false);
  const [planChangeError, setPlanChangeError] = useState<string | null>(null);
  const [planChangePending, startPlanChangeTransition] = useTransition();

  const subscriptionStatus = advisorSubscription?.status ?? "NONE";
  const currentClientCount = advisorSubscription?.currentClientCount ?? 0;

  const executePlanChange = useCallback(
    (tier: SelfServeTier) => {
      setPlanChangeError(null);
      startPlanChangeTransition(async () => {
        if (changePlanMode === "stripe_update") {
          const res = await switchSubscriptionPlan({ tier, billingCycle });
          if (!res.success) {
            setPlanChangeError(res.error);
            return;
          }
          router.refresh();
          return;
        }
        const action =
          audience === "enterprise"
            ? createEnterpriseCheckoutSession
            : createCheckoutSession;
        const res = await action({ tier, billingCycle });
        if (!res.success) {
          setPlanChangeError(res.error);
          return;
        }
        window.location.href = res.url;
      });
    },
    [audience, billingCycle, changePlanMode, router],
  );

  const requestPlanChange = useCallback(
    (tier: SelfServeTier) => {
      const input = {
        targetTier: tier,
        targetBillingCycle: billingCycle,
        committedPlan,
        changePlanMode,
        subscriptionStatus,
        currentClientCount,
      };
      if (shouldConfirmPlanChange(input)) {
        setPendingPlanTier(tier);
        setPlanChangeDialogOpen(true);
        return;
      }
      executePlanChange(tier);
    },
    [
      billingCycle,
      changePlanMode,
      committedPlan,
      currentClientCount,
      executePlanChange,
      subscriptionStatus,
    ],
  );

  const planChangeExplainer = useMemo(() => {
    if (!pendingPlanTier) return null;
    return buildPlanChangeExplainer({
      targetTier: pendingPlanTier,
      targetBillingCycle: billingCycle,
      committedPlan,
      changePlanMode,
      subscriptionStatus,
      currentClientCount,
    });
  }, [
    pendingPlanTier,
    billingCycle,
    committedPlan,
    changePlanMode,
    subscriptionStatus,
    currentClientCount,
  ]);

  const planChangeConfirmDisabled = pendingPlanTier
    ? clientsOverTierCapacity(currentClientCount, pendingPlanTier) > 0
    : false;

  const onConfirmPlanChange = useCallback(() => {
    if (!pendingPlanTier) return;
    const tier = pendingPlanTier;
    setPlanChangeDialogOpen(false);
    setPendingPlanTier(null);
    executePlanChange(tier);
  }, [executePlanChange, pendingPlanTier]);

  const requestPlanChangeHandler = externalRequestPlanChange ?? requestPlanChange;
  const planChangePendingState = externalPlanChangePending ?? planChangePending;
  const planChangeErrorState = externalPlanChangeError ?? planChangeError;

  const awaitingCheckoutOnly =
    changePlanMode === "checkout" &&
    committedPlan !== null &&
    subscriptionStatus !== "CANCELLED" &&
    subscriptionStatus !== "NONE";

  const pricingByTier = Object.fromEntries(pricing.map((row) => [row.tier, row])) as Record<
    SelfServeTier,
    PublicTierPricing
  >;

  useEffect(() => {
    if (suppressCheckoutIntent || !checkoutPlanIntent || !billingEnabled || checkoutStarted.current) {
      return;
    }
    checkoutStarted.current = true;
    if (changePlanMode === "stripe_update") {
      router.replace(
        audience === "enterprise" ? "/advisor/enterprise/pricing" : "/pricing",
        { scroll: false },
      );
      return;
    }
    if (!canSubscribe) {
      router.replace(
        audience === "enterprise" ? "/advisor/enterprise/pricing" : "/pricing",
        { scroll: false },
      );
      return;
    }
    requestPlanChange(checkoutPlanIntent.tier);
    router.replace(
      audience === "enterprise" ? "/advisor/enterprise/pricing" : "/pricing",
      { scroll: false },
    );
  }, [
    audience,
    billingEnabled,
    canSubscribe,
    changePlanMode,
    checkoutPlanIntent,
    requestPlanChange,
    router,
    suppressCheckoutIntent,
  ]);

  const clientLimitNote =
    audience === "enterprise" && firm
      ? `${firm.firmClientLimit} firm clients · ${firm.perAdvisorClientLimit} per advisor`
      : null;

  return (
    <div className={cn("space-y-8", surface === "billing" && "space-y-6")}>
      <TierPricingConfigAlert errors={configErrors} />

      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:justify-center",
          surface === "billing" ? "sm:justify-start" : "items-center",
        )}
      >
        <div
          className="inline-flex rounded-full border border-border/80 bg-card/90 p-1 shadow-sm"
          role="group"
          aria-label="Billing interval"
        >
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              billingCycle === "MONTHLY"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleBillingCycleChange("MONTHLY")}
            disabled={billingCycleLocked && contractedBillingCycle !== "MONTHLY"}
          >
            Monthly
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              billingCycle === "ANNUAL"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => handleBillingCycleChange("ANNUAL")}
            disabled={billingCycleLocked && contractedBillingCycle !== "ANNUAL"}
          >
            Annual
            <span className="ml-1.5 text-xs font-semibold text-brand">
              {ANNUAL_BILLING_SAVINGS_LABEL}
            </span>
          </button>
        </div>
      </div>

      {audience === "enterprise" && firm ? (
        <p className="text-center text-sm text-muted-foreground">
          Pricing shown for{" "}
          <span className="font-medium text-foreground">{firm.seatLimit} advisor seats</span>{" "}
          under {firm.enterpriseName}. Shared branding and team access are included.
        </p>
      ) : null}

      <div
        className={cn(
          "grid w-full items-stretch gap-5 sm:grid-cols-2",
          surface === "billing"
            ? "max-w-6xl 2xl:grid-cols-4"
            : "lg:grid-cols-2 xl:grid-cols-4",
        )}
      >
        {SELF_SERVE_TIERS.map((tier) => {
          const catalog = TIER_CATALOG[tier];
          const quote = priceForCycle(
            pricingByTier[tier],
            billingCycle,
            audience,
            firm?.seatLimit
          );
          const featured = catalog.featured;
          const isSamePlan =
            committedPlan !== null &&
            tier === committedPlan.tier &&
            billingCycle === committedPlan.billingCycle;
          const isCurrentSelection = changePlanMode === "stripe_update" && isSamePlan;
          const hasCommitted = committedPlan !== null;
          const isSameTier = hasCommitted && tier === committedPlan.tier;

          const isContractedTier =
            contractedModuleTier !== null && tier === contractedModuleTier;

          return (
            <article
              key={tier}
              className={cn(
                "relative flex h-full flex-col rounded-[1.5rem] border bg-card/85 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md",
                isCurrentSelection
                  ? "border-primary/35 ring-1 ring-primary/20"
                  : isContractedTier
                    ? "border-brand/40 ring-1 ring-brand/25"
                  : featured
                    ? "border-brand/40 ring-1 ring-brand/25"
                    : "border-border/70",
              )}
              aria-current={isCurrentSelection ? "true" : undefined}
            >
              {featured ? (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand/20 via-brand to-brand/20" />
              ) : null}

              <div className={PRICING_CARD_LAYOUT.badge}>
                {isCurrentSelection ? (
                  <Badge variant="secondary" className={PRICING_CARD_LAYOUT.statusBadge}>
                    Current plan
                  </Badge>
                ) : surface === "billing" &&
                  isSameTier &&
                  hasCommitted &&
                  awaitingCheckoutOnly ? (
                  <Badge variant="outline" className={PRICING_CARD_LAYOUT.statusBadge}>
                    Your plan
                  </Badge>
                ) : featured && surface === "marketing" ? (
                  <p className={PRICING_CARD_LAYOUT.featuredBadge}>
                    <Sparkles className="size-3 shrink-0" aria-hidden />
                    Most popular
                  </p>
                ) : null}
              </div>

              <h3 className="shrink-0 font-display text-2xl font-semibold leading-tight tracking-tight text-foreground">
                {catalog.name}
              </h3>

              <p className={PRICING_CARD_LAYOUT.tagline}>{catalog.tagline}</p>

              <p className={PRICING_CARD_LAYOUT.modules}>{catalog.modules}</p>

              <p className={PRICING_CARD_LAYOUT.clientLimit}>
                {clientLimitNote ?? `Up to ${catalog.clientLimit} active clients`}
              </p>

              <div className={PRICING_CARD_LAYOUT.priceBlock}>
                {quote ? (
                  <>
                    <p className="flex items-baseline gap-1">
                      <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                        {quote.main}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {quote.periodSuffix}
                      </span>
                    </p>
                    <p className="mt-1 min-h-8 text-xs leading-4 text-muted-foreground">
                      {quote.sub}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-destructive">
                    {configErrors.length > 0 && billingEnabled
                      ? "Pricing unavailable — configuration error"
                      : "Contact us for current pricing"}
                  </p>
                )}
              </div>

              <PlanTierFeatureList
                tier={tier}
                variant="compact"
                className={PRICING_CARD_LAYOUT.featureList}
              />

              <div className={PRICING_CARD_LAYOUT.action}>
                <PricingTierActionButton
                  tier={tier}
                  billingCycle={billingCycle}
                  billingEnabled={billingEnabled}
                  canSubscribe={canSubscribe}
                  featured={featured}
                  audience={audience}
                  surface={surface}
                  advisorSubscription={advisorSubscription}
                  onRequestPlanChange={requestPlanChangeHandler}
                  planChangePending={planChangePendingState}
                  planChangeError={planChangeErrorState}
                  contractTierLocked={
                    contractedModuleTier !== null && tier !== contractedModuleTier
                  }
                  isContractedTier={isContractedTier}
                />
              </div>
            </article>
          );
        })}
      </div>

      {surface === "marketing" ? (
        audience === "solo" ? (
        <>
          <section
            className="grid gap-5 rounded-[1.5rem] border border-border/70 bg-gradient-to-br from-card/95 via-muted/20 to-card/90 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr]"
            aria-labelledby="enterprise-pricing-heading"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-foreground/5 text-foreground">
                  <Building2 className="size-5" aria-hidden />
                </div>
                <div>
                  <p className="editorial-kicker">Enterprise</p>
                  <h2
                    id="enterprise-pricing-heading"
                    className="font-display text-2xl font-semibold tracking-tight"
                  >
                    Firms license the same modules
                  </h2>
                </div>
              </div>
              <p className="max-w-xl text-sm leading-7 text-muted-foreground">
                Enterprises subscribe to Essentials through Platinum with volume pricing — not a
                separate product line. The difference is shared firm branding, multiple advisor
                seats, and centralized billing under one contract.
              </p>
              <Button asChild>
                <Link href="/contact?intent=enterprise">
                  Talk to sales
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
            <ul className="space-y-2.5 self-center">
              {ENTERPRISE_PRICING_POINTS.map((point) => (
                <li key={point} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[1.25rem] border border-dashed border-border/80 bg-muted/15 px-5 py-5 sm:px-6">
            <h2 className="text-base font-semibold text-foreground">Solo advisors</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {SOLO_ADVISOR_PRICING_POINTS.map((point) => (
                <li key={point} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="rounded-[1.25rem] border border-border/70 bg-muted/15 px-5 py-5 sm:px-6">
          <h2 className="text-base font-semibold text-foreground">Included with your firm agreement</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {ENTERPRISE_PRICING_POINTS.map((point) => (
              <li key={point} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
      )
      ) : null}

      {!suppressPlanChangeDialog ? (
      <PlanChangeConfirmDialog
        explainer={planChangeExplainer}
        open={planChangeDialogOpen}
        onOpenChange={(open) => {
          setPlanChangeDialogOpen(open);
          if (!open) setPendingPlanTier(null);
        }}
        onConfirm={onConfirmPlanChange}
        pending={planChangePending}
        confirmDisabled={planChangeConfirmDisabled}
      />
      ) : null}
    </div>
  );
}
