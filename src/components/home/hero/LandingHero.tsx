"use client";

import Link from "next/link";
import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HeroAudienceSwitcher } from "@/components/home/hero/HeroAudienceSwitcher";
import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import {
  ADVISOR_HERO_FEATURES,
  HOME_HERO_FEATURES,
} from "@/components/home/hero/home-hero-features";
import {
  HERO_AUDIENCE_CONTENT,
  type HeroAudience,
} from "@/components/home/hero/hero-audience-content";
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

const contentMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const HERO_FEATURE_CARDS: Partial<
  Record<HeroAudience, typeof HOME_HERO_FEATURES>
> = {
  families: HOME_HERO_FEATURES,
  advisors: ADVISOR_HERO_FEATURES,
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
  const featureCards = HERO_FEATURE_CARDS[audience];
  const kicker =
    audience === "advisors" && advisorWorkspaceTitle
      ? advisorWorkspaceTitle
      : copy.kicker;
  const panelId = `${baseId}-panel-${audience}`;
  const tabId = `${baseId}-tab-${audience}`;
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <section
      className={cn(
        "hero-surface overflow-hidden rounded-[2rem] px-6 py-12 sm:px-10 sm:py-14 lg:px-14 lg:py-16",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex flex-col items-center text-center",
          featureCards ? "max-w-5xl" : "max-w-3xl",
        )}
      >
        <HeroAudienceSwitcher
          idPrefix={baseId}
          value={audience}
          onChange={setAudience}
          className="mb-8"
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
            className="flex w-full flex-col items-center gap-8"
          >
            <div className="space-y-4">
              <p className="editorial-kicker">{kicker}</p>
              <h1 className="text-4xl font-semibold leading-[1.08] text-balance sm:text-5xl lg:text-[3.25rem]">
                {copy.headline}
              </h1>
              <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                {copy.supporting}
              </p>
              {copy.subtext ? (
                <p className="text-sm font-medium text-muted-foreground">{copy.subtext}</p>
              ) : null}
            </div>

            {copy.overviewSteps?.length ? (
              <ol
                className="grid w-full max-w-2xl gap-4 text-left sm:grid-cols-3 sm:gap-5"
                data-testid="landing-hero-overview-steps"
              >
                {copy.overviewSteps.map(({ step, title, description }) => (
                  <li
                    key={step}
                    className="rounded-xl border border-border/60 bg-background/50 px-4 py-3.5"
                  >
                    <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card text-xs font-semibold tabular-nums">
                      {step}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {description}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}

            {authenticated ? (
              <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild size="lg" className="min-h-12 w-full sm:w-auto sm:min-w-[12rem]">
                  <Link href="/dashboard">
                    Continue to Dashboard
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-h-12 w-full sm:w-auto">
                  <Link href="/settings">Account settings</Link>
                </Button>
              </div>
            ) : (
              <div className="flex w-full max-w-lg flex-col items-center gap-4">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button
                    asChild
                    size="lg"
                    className="min-h-12 w-full sm:w-auto sm:min-w-[12rem]"
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
                    className="min-h-12 w-full sm:w-auto sm:min-w-[10rem]"
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

                <ul
                  className="space-y-1.5 text-sm leading-6 text-muted-foreground"
                  aria-label="Additional information"
                >
                  {copy.helperLinks.map((item) => (
                    <li key={item.id}>
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

            {featureCards?.length ? (
              <ul
                className="grid w-full gap-4 text-left sm:grid-cols-3"
                data-testid="landing-hero-feature-cards"
                aria-label="Platform capabilities"
              >
                {featureCards.map((feature) => (
                  <li key={feature.title}>
                    <HeroFeatureCard
                      title={feature.title}
                      description={feature.description}
                      icon={feature.icon}
                      className="h-full"
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            {authenticated ? (
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-semibold text-foreground">{userEmail}</span>
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
                {audience === "overview" ? (
                  <Link
                    href="#how-it-works"
                    className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                    data-testid="landing-hero-workflow-link"
                  >
                    See full workflow ↓
                  </Link>
                ) : (
                  <Link
                    href="#platform-preview"
                    className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                    data-testid="landing-hero-sample-link"
                  >
                    See sample governance output ↓
                  </Link>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
