"use client";

import Link from "next/link";
import { useId } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { HeroAudienceSwitcher } from "@/components/home/hero/HeroAudienceSwitcher";
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
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
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

            {authenticated ? (
              <p className="text-sm text-muted-foreground">
                Signed in as{" "}
                <span className="font-semibold text-foreground">{userEmail}</span>
              </p>
            ) : (
              <Link
                href="#platform-preview"
                className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
              >
                See sample governance output ↓
              </Link>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
