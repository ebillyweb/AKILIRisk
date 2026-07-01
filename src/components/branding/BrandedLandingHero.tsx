import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HeroFeatureCard } from "@/components/home/hero/HeroFeatureCard";
import { HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import type { BrandedLandingCopy } from "@/lib/branding/landing-copy";
import { Button } from "@/components/ui/button";

type BrandedLandingHeroProps = {
  copy: BrandedLandingCopy;
  startHref: string;
  signInHref: string;
  requestReviewHref: string;
};

export function BrandedLandingHero({
  copy,
  startHref,
  signInHref,
  requestReviewHref,
}: BrandedLandingHeroProps) {
  return (
    <div className="flex w-full flex-col items-center gap-8 text-center">
      <div className="space-y-4">
        <p className="editorial-kicker">{copy.kicker}</p>
        <h2 className="text-4xl font-semibold leading-[1.08] text-balance sm:text-5xl lg:text-[3.25rem]">
          {copy.headline}
        </h2>
        <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          {copy.subheadline}
        </p>
        {copy.subtext ? (
          <p className="text-sm font-medium text-muted-foreground">{copy.subtext}</p>
        ) : null}
      </div>

      <div className="flex w-full max-w-lg flex-col items-center gap-4">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg" className="min-h-12 w-full sm:w-auto sm:min-w-[12rem]">
            <Link href={startHref} title="Start your personal risk profile">
              Start Assessment
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="min-h-12 w-full sm:w-auto sm:min-w-[10rem]"
          >
            <Link href={signInHref} title="Sign in to your client account">
              Sign In
            </Link>
          </Button>
        </div>

        <ul
          className="space-y-1.5 text-sm leading-6 text-muted-foreground"
          aria-label="Additional information"
        >
          <li>
            Don&apos;t have an invite code?{" "}
            <Link
              href={requestReviewHref}
              className="font-semibold text-foreground underline-offset-4 hover:underline"
            >
              Request a review
            </Link>
          </li>
          <li>
            Private and encrypted. Responses visible only to your assigned professional.
          </li>
        </ul>
      </div>

      <ul
        className="grid w-full gap-4 text-left sm:grid-cols-3"
        data-testid="branded-landing-feature-cards"
        aria-label="Platform capabilities"
      >
        {HOME_HERO_FEATURES.map((feature) => (
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
    </div>
  );
}
