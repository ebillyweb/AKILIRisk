import { HERO_AUDIENCE_CONTENT } from "@/components/home/hero/hero-audience-content";
import { HOME_HERO_FEATURES } from "@/components/home/hero/home-hero-features";
import type {
  AdvisorBrandingData,
  LandingFeatureCard,
} from "@/lib/validation/branding";
import {
  LANDING_CARD_DESCRIPTION_MAX,
  LANDING_CARD_TITLE_MAX,
  LANDING_FEATURE_CARD_COUNT,
} from "@/lib/validation/branding";

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

/** Platform default feature cards (title + description), all shown. Icons are
 *  mapped separately by index from HOME_HERO_FEATURES at render time. */
export const DEFAULT_LANDING_FEATURE_CARDS: LandingFeatureCard[] =
  HOME_HERO_FEATURES.slice(0, LANDING_FEATURE_CARD_COUNT).map((feature) => ({
    title: feature.title,
    description: feature.description,
    visible: true,
  }));

/**
 * Normalize stored feature-card overrides into exactly LANDING_FEATURE_CARD_COUNT
 * cards, merged over the platform defaults. Missing/blank title or description
 * falls back to the default so a card is never rendered empty; `visible`
 * defaults to true. Length caps are enforced defensively.
 */
export function resolveLandingFeatureCards(
  stored: unknown,
): LandingFeatureCard[] {
  const rows = Array.isArray(stored) ? stored : [];
  return DEFAULT_LANDING_FEATURE_CARDS.map((fallback, index) => {
    const raw = rows[index];
    if (!raw || typeof raw !== "object") return fallback;
    const record = raw as Record<string, unknown>;
    const title =
      typeof record.title === "string" && record.title.trim()
        ? record.title.trim().slice(0, LANDING_CARD_TITLE_MAX)
        : fallback.title;
    const description =
      typeof record.description === "string" && record.description.trim()
        ? record.description.trim().slice(0, LANDING_CARD_DESCRIPTION_MAX)
        : fallback.description;
    const visible =
      typeof record.visible === "boolean" ? record.visible : true;
    return { title, description, visible };
  });
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
