import { describe, expect, it } from "vitest";

import {
  defaultBrandedLandingCopy,
  resolveBrandedLandingCopy,
} from "./landing-copy";

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
