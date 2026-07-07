import { HERO_AUDIENCE_CONTENT } from "@/components/home/hero/hero-audience-content";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

export type BrandedLandingCopy = {
  kicker: string;
  headline: string;
  subheadline: string;
  subtext: string;
};

const FAMILY_DEFAULTS = HERO_AUDIENCE_CONTENT.families;

export function defaultBrandedLandingCopy(): BrandedLandingCopy {
  return {
    kicker: FAMILY_DEFAULTS.kicker,
    headline: FAMILY_DEFAULTS.headline,
    subheadline: FAMILY_DEFAULTS.supporting,
    subtext: FAMILY_DEFAULTS.subtext ?? "",
  };
}

export function resolveBrandedLandingCopy(
  branding: Partial<
    Pick<
      AdvisorBrandingData,
      | "landingKicker"
      | "landingHeadline"
      | "landingSubheadline"
      | "landingSubtext"
      | "tagline"
    >
  >,
): BrandedLandingCopy {
  const defaults = defaultBrandedLandingCopy();
  return {
    kicker: branding.landingKicker?.trim() || defaults.kicker,
    headline: branding.landingHeadline?.trim() || defaults.headline,
    subheadline: branding.landingSubheadline?.trim() || defaults.subheadline,
    subtext: branding.landingSubtext?.trim() || defaults.subtext,
  };
}
