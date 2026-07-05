import { describe, it, expect } from "vitest";
import {
  PLATFORM_INVITATION_CTA_COLOR,
  resolveInvitationEmailTheme,
} from "./invitation-email-theme";

describe("resolveInvitationEmailTheme (US-1B)", () => {
  it("uses platform presentation when branding is disabled", () => {
    const theme = resolveInvitationEmailTheme({
      brandingEnabled: false,
      advancedBrandingEnabled: true,
      logoUrl: "https://cdn.example.com/logo.png",
      primaryColor: "#ff0000",
    });

    expect(theme.brandingEnabled).toBe(false);
    expect(theme.showAdvisorLogo).toBe(false);
    expect(theme.logoUrl).toBeUndefined();
    expect(theme.accentColor).toBe(PLATFORM_INVITATION_CTA_COLOR);
    expect(theme.showPlatformAttribution).toBe(true);
  });

  it("omits advisor logos when branding is enabled", () => {
    const theme = resolveInvitationEmailTheme({
      brandingEnabled: true,
      advancedBrandingEnabled: false,
      logoUrl: "https://cdn.example.com/logo.png",
    });

    expect(theme.showAdvisorLogo).toBe(false);
    expect(theme.logoUrl).toBeUndefined();
    expect(theme.showPlatformAttribution).toBe(false);
  });

  it("omits logos even when a private S3 logo is stored", () => {
    const theme = resolveInvitationEmailTheme({
      brandingEnabled: true,
      advancedBrandingEnabled: false,
      logoS3Key: "advisors/adv-1/logos/logo.png",
      logoUrl:
        "https://akili-advisor-assets.s3.us-east-2.amazonaws.com/advisors/adv-1/logos/logo.png",
    });

    expect(theme.showAdvisorLogo).toBe(false);
  });

  it("applies primary color when branding and advanced branding are enabled", () => {
    const theme = resolveInvitationEmailTheme({
      brandingEnabled: true,
      advancedBrandingEnabled: true,
      primaryColor: "#4EA5D9",
    });

    expect(theme.accentColor).toBe("#4EA5D9");
  });

  it("falls back to platform CTA color when advanced branding is off", () => {
    const theme = resolveInvitationEmailTheme({
      brandingEnabled: true,
      advancedBrandingEnabled: false,
      primaryColor: "#4EA5D9",
    });

    expect(theme.accentColor).toBe(PLATFORM_INVITATION_CTA_COLOR);
  });
});
