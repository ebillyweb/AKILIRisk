import { describe, expect, it } from "vitest";

import {
  isAllowedAdminBrandingLogoS3Key,
  resolveAdminAdvisorListBranding,
} from "./advisor-list-branding";

describe("resolveAdminAdvisorListBranding", () => {
  const profile = {
    firmName: "Northbridge Elite",
    brandName: null,
    primaryColor: null,
    secondaryColor: null,
    accentColor: null,
    logoUrl: null,
    logoS3Key: null,
  };

  const enterprise = {
    name: "Northbridge Elite",
    brandName: "Northbridge",
    primaryColor: "#e85d04",
    secondaryColor: "#7b2cbf",
    accentColor: "#ffba08",
    logoUrl: "https://cdn.example.com/nb-logo.png",
    logoS3Key: "advisors/owner-profile/logos/logo.png",
    brandingEnabled: true,
  };

  it("uses enterprise branding for firm-linked advisors", () => {
    const resolved = resolveAdminAdvisorListBranding(profile, enterprise, {
      linkedToEnterprise: true,
    });

    expect(resolved.primaryColor).toBe("#e85d04");
    expect(resolved.logoUrl).toBe("https://cdn.example.com/nb-logo.png");
    expect(resolved.brandName).toBe("Northbridge");
  });

  it("keeps solo profile branding when enterprise branding is disabled", () => {
    const resolved = resolveAdminAdvisorListBranding(
      { ...profile, primaryColor: "#111111" },
      { ...enterprise, brandingEnabled: false },
      { linkedToEnterprise: true },
    );

    expect(resolved.primaryColor).toBe("#111111");
  });
});

describe("isAllowedAdminBrandingLogoS3Key", () => {
  it("allows advisor logo object keys", () => {
    expect(
      isAllowedAdminBrandingLogoS3Key("advisors/profile-1/logos/123-logo.png"),
    ).toBe(true);
    expect(isAllowedAdminBrandingLogoS3Key("other/path.png")).toBe(false);
  });
});
