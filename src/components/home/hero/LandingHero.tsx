"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { AkiliLogoLockup } from "@/components/home/AkiliLogoLockup";
import { HeroAudienceSwitcher } from "@/components/home/hero/HeroAudienceSwitcher";
import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import {
  HERO_AUDIENCE_CONTENT,
  type HeroAudience,
} from "@/components/home/hero/hero-audience-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHeroAudience } from "@/components/home/hero/useHeroAudience";
import { cn } from "@/lib/utils";

type LandingHeroProps = {
  initialAudience?: HeroAudience;
  authenticated: boolean;
  userEmail?: string | null;
  authenticatedActions?: ReactNode;
  className?: string;
};

const contentMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function LandingHero({
  initialAudience = "families",
  authenticated,
  userEmail,
  authenticatedActions,
  className,
}: LandingHeroProps) {
  const baseId = useId();
  const prefersReducedMotion = useReducedMotion();
  const { audience, setAudience } = useHeroAudience(initialAudience);
  const copy = HERO_AUDIENCE_CONTENT[audience];
  const panelId = `${baseId}-panel-${audience}`;
  const tabId = `${baseId}-tab-${audience}`;
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      className={cn(
        "hero-surface app-grid grid min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-12 lg:py-10",
        className
      )}
    >
      <section className="flex flex-col justify-between gap-8 lg:gap-10">
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
              <div className="space-y-4">
                <p className="editorial-kicker">{copy.kicker}</p>
                <div className="max-w-3xl space-y-4">
                  <h1 className="text-4xl font-semibold leading-[1.05] text-balance sm:text-6xl lg:text-[4.5rem]">
                    {copy.headline}
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    {copy.supporting}
                  </p>
                  {copy.subtext ? (
                    <p className="text-sm text-muted-foreground">{copy.subtext}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {authenticated ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    {authenticatedActions}
                  </div>
                ) : (
                  <>
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
                          className={cn(
                            "text-sm text-muted-foreground",
                            item.content === "text" && "text-xs"
                          )}
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
                  </>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
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
            {copy.features.map((feature) => (
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

      <aside className="mt-12 flex flex-col items-stretch gap-8 lg:mt-0 lg:pl-10">
        <div className="flex w-full justify-end text-foreground">
          <AkiliLogoLockup className="h-auto w-full max-w-[280px]" />
        </div>
        <Card className="w-full overflow-hidden">
          <CardContent className="space-y-8 pt-8">
            <div className="space-y-2">
              <p className="editorial-kicker">Our Company Ethos</p>
              <p className="text-xl font-medium leading-8 text-balance text-foreground/90">
                Governance requires clarity, not assumption.
              </p>
              <p className="border-l-2 border-brand/30 pl-4 text-base font-medium italic leading-7 text-foreground/90">
                Wealth grows through investment.
                <br />
                Legacy survives through governance.
              </p>
              <p className="text-sm leading-7 text-muted-foreground">
                Families often operate with informal decision structures that
                work — until they don&apos;t.
              </p>
            </div>

            <p className="text-sm leading-7 text-muted-foreground">
              This assessment identifies governance gaps across succession
              planning, authority structure, and family decision frameworks so
              they can be addressed proactively.
            </p>

            <div className="section-divider border-t pt-6 text-sm text-muted-foreground">
              {authenticated ? (
                <>
                  Signed in as{" "}
                  <span className="font-semibold text-foreground">
                    {userEmail}
                  </span>
                  . Continue to the dashboard, review recommendations, and
                  manage account security settings.
                </>
              ) : audience === "advisors" ? (
                <>
                  Advisors sign in to manage client governance profiles,
                  assessment progress, and structured recommendations from one
                  workspace.
                </>
              ) : (
                <>
                  Existing clients can sign in to continue an assessment,
                  review recommendations, and manage account security settings.
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
