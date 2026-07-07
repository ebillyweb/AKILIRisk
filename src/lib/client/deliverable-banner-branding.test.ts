import { describe, expect, it } from "vitest";
import {
  deliverableBannerBrandingProps,
  hexWithAlpha,
} from "@/lib/client/deliverable-banner-branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

const branding: AdvisorBrandingData = {
  brandingEnabled: true,
  advisorFirmName: "Independent Wealth Group",
  brandName: "Independent Wealth",
  tagline: "Governance for modern families",
  primaryColor: "#1a1a2e",
  secondaryColor: "#f5f5f5",
  accentColor: "#10b981",
};

describe("deliverableBannerBrandingProps", () => {
  it("uses the advisor display title when branding is present", () => {
    expect(deliverableBannerBrandingProps(branding).advisorTeamLabel).toBe(
      "Independent Wealth Group",
    );
  });

  it("falls back to a neutral label without branding", () => {
    expect(deliverableBannerBrandingProps(null).advisorTeamLabel).toBe(
      "your advisor",
    );
  });
});

describe("hexWithAlpha", () => {
  it("returns rgba with the requested alpha", () => {
    expect(hexWithAlpha("#112233", 0.5)).toBe("rgba(17, 34, 51, 0.5)");
  });
});
