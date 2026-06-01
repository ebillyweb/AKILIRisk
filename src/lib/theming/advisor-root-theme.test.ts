import { describe, expect, it } from "vitest";
import { buildAdvisorRootThemeCss } from "./advisor-root-theme";

describe("buildAdvisorRootThemeCss", () => {
  it("emits :root CSS variables for intake/assessment SSR theming", () => {
    const css = buildAdvisorRootThemeCss({
      brandName: "Firm",
      advisorFirmName: "Firm",
      tagline: null,
      primaryColor: "#112233",
      secondaryColor: "#ddeeff",
      accentColor: "#445566",
      logoUrl: "/api/branded/advisor-logo",
      logoS3Key: "advisors/a/logos/logo.png",
      logoContentType: "image/png",
      logoFileSize: 100,
      logoUploadedAt: new Date(),
      websiteUrl: null,
      emailFooterText: null,
      supportEmail: null,
      supportPhone: null,
      brandingEnabled: true,
      customDomainEnabled: false,
    });

    expect(css).toContain(":root{");
    expect(css).toContain("--advisor-primary:");
    expect(css).toContain("--primary:hsl(");
  });
});
