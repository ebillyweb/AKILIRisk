import { describe, expect, it } from "vitest";
import {
  CLIENT_ADVISOR_LOGO_PATH,
  clientPortalBrandingDisplayTitle,
  clientPortalLogoImgSrc,
} from "./client-portal-branding";
import type { AdvisorBrandingData } from "@/lib/validation/branding";

function branding(
  overrides: Partial<AdvisorBrandingData> = {},
): AdvisorBrandingData {
  return {
    brandName: "Test Firm",
    brandingEnabled: true,
    ...overrides,
  } as AdvisorBrandingData;
}

describe("clientPortalLogoImgSrc", () => {
  it("proxies when logoS3Key is set", () => {
    expect(
      clientPortalLogoImgSrc(
        branding({ logoS3Key: "advisors/abc/logos/logo.png" }),
      ),
    ).toBe(CLIENT_ADVISOR_LOGO_PATH);
  });

  it("proxies private S3 logoUrl without logoS3Key", () => {
    expect(
      clientPortalLogoImgSrc(
        branding({
          logoUrl:
            "https://akili-advisor-assets.s3.us-east-2.amazonaws.com/advisors/abc/logos/x.png",
        }),
      ),
    ).toBe(CLIENT_ADVISOR_LOGO_PATH);
  });

  it("passes through public https URLs", () => {
    const url = "https://cdn.example.com/logo.png";
    expect(clientPortalLogoImgSrc(branding({ logoUrl: url }))).toBe(url);
  });

  it("returns null for empty branding", () => {
    expect(clientPortalLogoImgSrc(branding({}))).toBeNull();
  });
});

describe("clientPortalBrandingDisplayTitle", () => {
  it("prefers advisorFirmName over brandName", () => {
    expect(
      clientPortalBrandingDisplayTitle(
        branding({
          advisorFirmName: "eBilly Wealth Group",
          brandName: "eBilly Wealth",
        }),
      ),
    ).toBe("eBilly Wealth Group");
  });

  it("falls back to brandName when advisorFirmName is empty", () => {
    expect(
      clientPortalBrandingDisplayTitle(
        branding({
          advisorFirmName: null,
          brandName: "Solo Practice",
        }),
      ),
    ).toBe("Solo Practice");
  });
});
