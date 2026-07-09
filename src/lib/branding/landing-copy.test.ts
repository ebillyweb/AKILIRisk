import { describe, expect, it } from "vitest";

import {
  DEFAULT_LANDING_FEATURE_CARDS,
  defaultBrandedLandingCopy,
  resolveBrandedLandingCopy,
  resolveLandingFeatureCards,
} from "./landing-copy";
import {
  LANDING_CARD_DESCRIPTION_MAX,
  LANDING_CARD_TITLE_MAX,
} from "@/lib/validation/branding";

describe("resolveBrandedLandingCopy", () => {
  it("returns platform family defaults when branding fields are unset", () => {
    expect(resolveBrandedLandingCopy({})).toEqual(defaultBrandedLandingCopy());
  });

  it("uses custom landing fields when provided", () => {
    expect(
      resolveBrandedLandingCopy({
        landingKicker: "For clients of Northbridge",
        landingHeadline: "Your firm's risk profile starts here.",
        landingSubheadline: "Complete a guided assessment with your advisor team.",
        landingSubtext: "About 15 minutes",
      }),
    ).toMatchObject({
      kicker: "For clients of Northbridge",
      headline: "Your firm's risk profile starts here.",
      subheadline: "Complete a guided assessment with your advisor team.",
      subtext: "About 15 minutes",
    });
  });
});

describe("resolveLandingFeatureCards", () => {
  it("returns platform defaults for null/empty input", () => {
    expect(resolveLandingFeatureCards(null)).toEqual(DEFAULT_LANDING_FEATURE_CARDS);
    expect(resolveLandingFeatureCards([])).toEqual(DEFAULT_LANDING_FEATURE_CARDS);
    expect(resolveLandingFeatureCards(undefined)).toEqual(DEFAULT_LANDING_FEATURE_CARDS);
  });

  it("always returns exactly the fixed card count", () => {
    expect(resolveLandingFeatureCards([{ title: "Only one" }])).toHaveLength(
      DEFAULT_LANDING_FEATURE_CARDS.length,
    );
  });

  it("overrides title/description and honors visibility", () => {
    const result = resolveLandingFeatureCards([
      { title: "Concierge Onboarding", description: "White-glove setup.", visible: true },
      { title: "Kept default desc", visible: false },
    ]);
    expect(result[0]).toEqual({
      title: "Concierge Onboarding",
      description: "White-glove setup.",
      visible: true,
    });
    // Blank description falls back to the default so a card is never empty.
    expect(result[1]).toEqual({
      title: "Kept default desc",
      description: DEFAULT_LANDING_FEATURE_CARDS[1].description,
      visible: false,
    });
    // Untouched third card keeps the platform default (visible).
    expect(result[2]).toEqual(DEFAULT_LANDING_FEATURE_CARDS[2]);
  });

  it("defaults visibility to true when not a boolean", () => {
    const result = resolveLandingFeatureCards([{ title: "A", visible: "yes" }]);
    expect(result[0].visible).toBe(true);
  });

  it("enforces length caps defensively", () => {
    const longTitle = "x".repeat(LANDING_CARD_TITLE_MAX + 20);
    const longDescription = "y".repeat(LANDING_CARD_DESCRIPTION_MAX + 50);
    const result = resolveLandingFeatureCards([
      { title: longTitle, description: longDescription, visible: true },
    ]);
    expect(result[0].title).toHaveLength(LANDING_CARD_TITLE_MAX);
    expect(result[0].description).toHaveLength(LANDING_CARD_DESCRIPTION_MAX);
  });
});
