import { describe, expect, it } from "vitest";

import { mapEnterpriseToBrandingData } from "./branding";

describe("mapEnterpriseToBrandingData", () => {
  it("uses enterprise name when brandName is unset", () => {
    const branding = mapEnterpriseToBrandingData({
      name: "Acme Wealth",
      brandName: null,
      tagline: null,
      primaryColor: "#111111",
      secondaryColor: null,
      accentColor: null,
      logoUrl: null,
      logoS3Key: null,
      logoContentType: null,
      logoFileSize: null,
      logoUploadedAt: null,
      websiteUrl: null,
      emailFooterText: null,
      supportEmail: null,
      supportPhone: null,
      brandingEnabled: true,
      customDomainEnabled: false,
    });

    expect(branding.brandName).toBe("Acme Wealth");
    expect(branding.advisorFirmName).toBe("Acme Wealth");
  });
});
