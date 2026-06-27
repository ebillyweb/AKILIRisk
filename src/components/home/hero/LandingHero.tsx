"use client";

import Link from "next/link";
import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { HeroAudienceSwitcher } from "@/components/home/hero/HeroAudienceSwitcher";
import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import {
  HERO_AUDIENCE_CONTENT,
  type HeroAudience,
} from "@/components/home/hero/hero-audience-content";
import { ADVISOR_HERO_FEATURES, HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import { GovernanceRadarPreview } from "@/components/home/GovernanceRadarPreview";
import { Button } from "@/components/ui/button";
import { useHeroAudience } from "@/components/home/hero/useHeroAudience";
import { cn } from "@/lib/utils";

type LandingHeroProps = {
  initialAudience?: HeroAudience;
  authenticated: boolean;
  userEmail?: string | null;
  advisorWorkspaceTitle?: string;
  className?: string;
};

const TRUST_SIGNALS = [
  { label: "Encrypted & private", icon: Lock },
  { label: "Advisor-grade methodology", icon: ShieldCheck },
  { label: "Actionable recommendations", icon: Sparkles },
] as const;

const contentMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function LandingHero({
  initialAudience = "families",
  authenticated,
  userEmail,
  advisorWorkspaceTitle,
  className,
}: LandingHeroProps) {
  const baseId = useId();
  const prefersReducedMotion = useReducedMotion();
  const { audience, setAudience } = useHeroAudience(initialAudience);
  const copy = HERO_AUDIENCE_CONTENT[audience];
  const heroFeatures =
    audience === "families" ? HOME_HERO_FEATURES : ADVISOR_HERO_FEATURES;
  const kicker =
    audience === "advisors" && advisorWorkspaceTitle
      ? advisorWorkspaceTitle
      : copy.kicker;
  const panelId = `${baseId}-panel-${audience}`;
  const tabId = `${baseId}-tab-${audience}`;
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      className={cn(
        "hero-surface app-grid grid overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-12 lg:py-10",
        className,
      )}
    >
      <section className="flex flex-col justify-between gap-10">
        <div className="space-y-7">
          <HeroAudienceSwitcher
            idPrefix={baseId}
            value={audience}
            onChange={setAudience}
          />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={audience}
              id={panelId}
              role="tabpanel"
              aria-labelledby={tabId}
              data-testid="landing-hero-panel"
              data-audience={audience}
              initial={contentMotion.initial}
              animate={contentMotion.animate}
              exit={contentMotion.exit}
              transition={transition}
              className="space-y-7"
            >
              <div className="space-y-5">
                <p className="editorial-kicker">{kicker}</p>
                <div className="max-w-3xl space-y-4">
                  <h1 className="text-4xl font-semibold leading-[1.05] text-balance sm:text-5xl lg:text-[3.75rem]">
                    {copy.headline}
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    {copy.supporting}
                  </p>
                  {copy.subtext ? (
                    <p className="inline-flex rounded-full border border-border/70 bg-background/50 px-3 py-1 text-sm font-medium text-foreground/90">
                      {copy.subtext}
                    </p>
                  ) : null}
                </div>
              </div>

              {authenticated ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="min-h-12 w-full sm:min-w-[13rem]">
                    <Link href="/dashboard">
                      Continue to Dashboard
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="min-h-12 w-full sm:flex-1">
                    <Link href="/settings">Account settings</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      asChild
                      size="lg"
                      className="w-full min-h-12 sm:min-w-[13rem] sm:flex-1"
                    >
                      <Link
                        href={copy.primaryCta.href}
                        title={copy.primaryCta.title}
                        data-testid="landing-hero-primary-cta"
                      >
                        {copy.primaryCta.label}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="w-full min-h-12 sm:flex-1"
                    >
                      <Link
                        href={copy.secondaryCta.href}
                        title={copy.secondaryCta.title}
                        data-testid="landing-hero-secondary-cta"
                      >
                        {copy.secondaryCta.label}
                      </Link>
                    </Button>
                  </div>

                  <ul className="space-y-2" aria-label="Additional information">
                    {copy.helperLinks.map((item) => (
                      <li
                        key={item.id}
                        className="text-sm leading-6 text-muted-foreground"
                      >
                        {item.content === "link" && item.href && item.linkLabel ? (
                          <>
                            {item.text}{" "}
                            <Link
                              href={item.href}
                              className="font-semibold text-foreground underline-offset-4 hover:underline"
                            >
                              {item.linkLabel}
                            </Link>
                          </>
                        ) : (
                          item.text
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <ul className="flex flex-wrap gap-2" aria-label="Trust signals">
            {TRUST_SIGNALS.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/45 px-3 py-1.5 text-xs font-medium text-muted-foreground"
              >
                <Icon className="size-3.5 text-brand" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${audience}-features`}
            role="presentation"
            initial={contentMotion.initial}
            animate={contentMotion.animate}
            exit={contentMotion.exit}
            transition={{
              ...transition,
              delay: prefersReducedMotion ? 0 : 0.04,
            }}
            className="grid gap-4 sm:grid-cols-3"
          >
            {heroFeatures.map((feature) => (
              <HeroFeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={feature.icon}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </section>

      <aside className="mt-10 flex flex-col gap-6 lg:mt-0 lg:pl-8">
        <div className="marketing-card overflow-hidden rounded-[1.25rem] border border-border/70 bg-card/85 p-6 sm:p-7">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="editorial-kicker">Live platform preview</p>
                <p className="mt-2 font-display text-2xl font-semibold text-foreground">
                  Governance score snapshot
                </p>
              </div>
              <p className="rounded-full bg-trust-accent/12 px-3 py-1 text-xs font-semibold text-trust-accent">
                Sample
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-4xl font-semibold tabular-nums text-foreground">
                  7.2
                  <span className="ml-1 text-lg font-normal text-muted-foreground">/ 10</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Moderate governance exposure across five pillars.
                </p>
              </div>
              <div className="h-28 w-28 shrink-0 self-center sm:h-32 sm:w-32">
                <GovernanceRadarPreview className="h-full w-full text-brand" />
              </div>
            </div>

            <div className="space-y-2 border-t border-border/60 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Top risks identified
              </p>
              <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                <li>No defined succession triggers</li>
                <li>Informal authority structure</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-border/60 bg-background/35 px-5 py-4 text-sm leading-6 text-muted-foreground">
          {authenticated ? (
            <>
              Signed in as{" "}
              <span className="font-semibold text-foreground">{userEmail}</span>.
              Continue to your dashboard to review recommendations and manage
              account security.
            </>
          ) : audience === "advisors" ? (
            <>
              Advisors sign in with email and password. New firms can{" "}
              <Link href="/signup/advisor" className="font-semibold text-foreground hover:underline">
                create an account
              </Link>{" "}
              or{" "}
              <Link href="/pricing" className="font-semibold text-foreground hover:underline">
                compare plans
              </Link>
              .
            </>
          ) : (
            <>
              Existing clients sign in with a one-time email link. New families
              need an invite code from their advisor to{" "}
              <Link href="/start" className="font-semibold text-foreground hover:underline">
                start the assessment
              </Link>
              .
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
