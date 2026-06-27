"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { ADVISOR_PIPELINE_HREF } from "@/lib/billing/client-limit";
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
import { cn } from "@/lib/utils";

export type PricingAudience = "solo" | "enterprise";

type PricingTierGridProps = {
  pricing: PublicTierPricing[];
  billingEnabled: boolean;
  canSubscribe: boolean;
  audience?: PricingAudience;
  firm?: EnterprisePricingFirmContext;
  checkoutPlanIntent?: { tier: SelfServeTier; billingCycle: BillingCycle } | null;
  advisorSubscription?: SubscriptionDetailsDTO | null;
  initialBillingCycle?: BillingCycle;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function priceForCycle(
  tierPricing: PublicTierPricing,
  cycle: BillingCycle,
  audience: PricingAudience,
  seatLimit?: number
): { main: string; sub?: string } | null {
  const perSeat =
    cycle === "MONTHLY" ? tierPricing.monthly : tierPricing.annual;
  if (!perSeat) return null;

  if (audience === "enterprise" && seatLimit && seatLimit > 1) {
    if (cycle === "MONTHLY") {
      const totalCents = perSeat.amountCents * seatLimit;
      return {
        main: formatMoney(totalCents, perSeat.currency),
        sub: `${perSeat.display} × ${seatLimit} advisor seats / mo`,
      };
    }
    const annualTotalCents = perSeat.amountCents * seatLimit;
    return {
      main: formatMoney(Math.round(annualTotalCents / 12), perSeat.currency),
      sub: `${formatMoney(annualTotalCents, perSeat.currency)} / yr (${perSeat.display} per seat × ${seatLimit})`,
    };
  }

  if (cycle === "MONTHLY") {
    return { main: perSeat.display };
  }
  return {
    main: perSeat.monthlyEquivalentDisplay ?? perSeat.display,
    sub: `${perSeat.display} billed annually`,
  };
}

function PricingTierActionButton({
  tier,
  billingCycle,
  billingEnabled,
  canSubscribe,
  featured,
  audience,
  advisorSubscription,
}: {
  tier: SelfServeTier;
  billingCycle: BillingCycle;
  billingEnabled: boolean;
  canSubscribe: boolean;
  featured?: boolean;
  audience: PricingAudience;
  advisorSubscription?: SubscriptionDetailsDTO | null;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    Boolean(session?.user?.id) &&
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
  const isSameTier = hasCommitted && tier === committedPlan.tier;
  const isSamePlan =
    hasCommitted &&
    tier === committedPlan.tier &&
    billingCycle === committedPlan.billingCycle;
  const isCurrentSelection = changePlanMode === "stripe_update" && isSamePlan;
  const nextTier =
    isCurrentSelection && committedPlan ? nextSelfServeTier(committedPlan.tier) : null;

  const onSelectPlan = useCallback(
    (selectedTier: SelfServeTier) => {
      setError(null);
      startTransition(async () => {
        if (changePlanMode === "stripe_update") {
          const res = await switchSubscriptionPlan({ tier: selectedTier, billingCycle });
          if (!res.success) {
            setError(res.error);
            return;
          }
          router.refresh();
          return;
        }
        const action =
          audience === "enterprise"
            ? createEnterpriseCheckoutSession
            : createCheckoutSession;
        const res = await action({ tier: selectedTier, billingCycle });
        if (!res.success) {
          setError(res.error);
          return;
        }
        window.location.href = res.url;
      });
    },
    [audience, billingCycle, changePlanMode, router],
  );

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
          onClick={() => onSelectPlan(nextTier)}
        >
          {pending ? busyLabel : "Upgrade"}
        </Button>
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
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
          onClick={() => onSelectPlan(tier)}
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
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
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
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
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
        {error ? (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        className="w-full"
        variant={featured ? "default" : "outline"}
        disabled={pending}
        onClick={() => onSelectPlan(tier)}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Redirecting…
          </>
        ) : (
          <>
            Get Started
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PricingTierGrid({
  pricing,
  billingEnabled,
  canSubscribe,
  audience = "solo",
  firm,
  checkoutPlanIntent = null,
  advisorSubscription = null,
  initialBillingCycle,
}: PricingTierGridProps) {
  const router = useRouter();
  const changePlanMode = resolvePricingPlanChangeMode(advisorSubscription);
  const committedPlan = resolveCommittedPlan(advisorSubscription);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(() => {
    if (checkoutPlanIntent?.billingCycle) {
      return checkoutPlanIntent.billingCycle;
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
  const checkoutStarted = useRef(false);
  const pricingByTier = Object.fromEntries(pricing.map((row) => [row.tier, row])) as Record<
    SelfServeTier,
    PublicTierPricing
  >;

  useEffect(() => {
    if (!checkoutPlanIntent || !billingEnabled || !canSubscribe || checkoutStarted.current) {
      return;
    }
    checkoutStarted.current = true;
    const action =
      audience === "enterprise"
        ? createEnterpriseCheckoutSession
        : createCheckoutSession;
    void action({
      tier: checkoutPlanIntent.tier,
      billingCycle: checkoutPlanIntent.billingCycle,
    }).then((res) => {
      if (res.success) {
        window.location.href = res.url;
        return;
      }
      router.replace(
        audience === "enterprise" ? "/advisor/enterprise/pricing" : "/pricing",
        { scroll: false }
      );
    });
  }, [audience, billingEnabled, canSubscribe, checkoutPlanIntent, router]);

  const clientLimitNote =
    audience === "enterprise" && firm
      ? `${firm.firmClientLimit} firm clients · ${firm.perAdvisorClientLimit} per advisor`
      : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
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
            onClick={() => setBillingCycle("MONTHLY")}
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
            onClick={() => setBillingCycle("ANNUAL")}
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

      <div className="grid items-stretch gap-5 lg:grid-cols-2 xl:grid-cols-4">
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
          const isSameTier = committedPlan !== null && tier === committedPlan.tier;

          return (
            <article
              key={tier}
              className={cn(
                "relative flex h-full flex-col rounded-[1.5rem] border bg-card/85 p-6 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md",
                isCurrentSelection
                  ? "border-primary/35 ring-1 ring-primary/20"
                  : featured
                    ? "border-brand/40 ring-1 ring-brand/25"
                    : "border-border/70",
              )}
              aria-current={isCurrentSelection ? "true" : undefined}
            >
              {featured ? (
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand/20 via-brand to-brand/20" />
              ) : null}

              <div className="mb-3 flex h-6 items-center">
                {isCurrentSelection ? (
                  <Badge
                    variant="secondary"
                    className="text-[0.65rem] font-semibold normal-case tracking-normal"
                  >
                    Current plan
                  </Badge>
                ) : isSameTier &&
                  committedPlan !== null &&
                  changePlanMode === "stripe_update" &&
                  !isSamePlan ? (
                  <Badge
                    variant="outline"
                    className="text-[0.65rem] font-semibold normal-case tracking-normal"
                  >
                    Other interval
                  </Badge>
                ) : featured ? (
                  <p className="inline-flex w-fit items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-brand">
                    <Sparkles className="size-3" aria-hidden />
                    Most popular
                  </p>
                ) : null}
              </div>

              <header className="space-y-2">
                <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight text-foreground">
                  {catalog.name}
                </h3>
                <p className="min-h-12 text-sm leading-6 text-muted-foreground">
                  {catalog.tagline}
                </p>
              </header>

              <div className="mt-5 min-h-[5.5rem]">
                {quote ? (
                  <>
                    <p className="flex items-baseline gap-1">
                      <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground">
                        {quote.main}
                      </span>
                      {audience === "solo" ? (
                        <span className="text-sm text-muted-foreground">/mo</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">/mo firm</span>
                      )}
                    </p>
                    <p className="mt-1 min-h-8 text-xs leading-4 text-muted-foreground">
                      {quote.sub ??
                        (billingCycle === "MONTHLY" ? "Billed monthly" : "Billed annually")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Contact us for current pricing
                  </p>
                )}
              </div>

              <p className="mt-4 min-h-10 text-xs font-medium uppercase leading-5 tracking-wide text-muted-foreground">
                {catalog.modules}
              </p>
              <p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">
                {clientLimitNote ?? `Up to ${catalog.clientLimit} active clients`}
              </p>

              <ul className="mt-5 flex-1 space-y-2.5 border-t border-border/60 pt-5">
                {catalog.highlights.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-0">
                <PricingTierActionButton
                  tier={tier}
                  billingCycle={billingCycle}
                  billingEnabled={billingEnabled}
                  canSubscribe={canSubscribe}
                  featured={featured}
                  audience={audience}
                  advisorSubscription={advisorSubscription}
                />
              </div>
            </article>
          );
        })}
      </div>

      {audience === "solo" ? (
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
      )}
    </div>
  );
}
