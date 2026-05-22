import { describe, it, expect } from "vitest";
import { renderInvitationTemplate } from "./email";
import { resolveInvitationEmailTheme } from "./invitation-email-theme";

const baseAdvisor = {
  advisorName: "Alex Advisor",
  advisorJobTitle: "Financial Advisor",
  advisorFirmName: "Test Advisory Firm",
  advisorEmail: "alex@firm.com",
  advisorPhone: "+1 555 0100",
  advisorLicenseNumber: "LIC-1",
  personalMessage: "Welcome aboard.",
  invitationUrl: "https://app.example/signup?invite=token",
};

describe("renderInvitationTemplate (US-1B)", () => {
  it("omits logo when branding is disabled", () => {
    const theme = resolveInvitationEmailTheme({
      brandingEnabled: false,
      advancedBrandingEnabled: true,
      logoUrl: "https://cdn.example.com/logo.png",
    });

    const html = renderInvitationTemplate({
      ...baseAdvisor,
      theme,
    });

    expect(html).not.toContain("https://cdn.example.com/logo.png");
    expect(html).toContain("AKILI Risk Intelligence");
    expect(html).toContain('background: #18181b');
  });

  it("includes logo and custom CTA when branding is enabled", () => {
    const theme = resolveInvitationEmailTheme({
      brandingEnabled: true,
      advancedBrandingEnabled: true,
      logoUrl: "https://cdn.example.com/logo.png",
      primaryColor: "#4EA5D9",
    });

    const html = renderInvitationTemplate({
      ...baseAdvisor,
      theme,
    });

    expect(html).toContain("https://cdn.example.com/logo.png");
    expect(html).toContain("background: #4EA5D9");
    expect(html).not.toContain("Sent via <strong>AKILI Risk Intelligence</strong>");
  });
});
