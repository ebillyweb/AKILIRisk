import { describe, expect, it } from "vitest";
import { renderEnhancedInvitationTemplate } from "./enhanced-email";

describe("renderEnhancedInvitationTemplate", () => {
  it("renders firm copy and colors without embedding logos", () => {
    const html = renderEnhancedInvitationTemplate({
      branding: {
        brandName: "eBilly's WebSolutions",
        tagline: "This is a my fancy tagline.",
        primaryColor: "#1a1a2e",
        secondaryColor: "#dbeafe",
        logoUrl:
          "https://akili-advisor-assets.s3.us-east-2.amazonaws.com/advisors/adv-1/logos/logo.png",
        brandingEnabled: true,
        customDomainEnabled: false,
      },
      personalMessage: "Please complete your assessment.",
      invitationUrl: "https://preview.akilirisk.com/signup?invite=token",
      clientName: "Buddy",
    });

    expect(html).not.toContain("<img");
    expect(html).not.toContain("akili-advisor-assets.s3.us-east-2.amazonaws.com");
    expect(html).toContain("eBilly&#039;s WebSolutions");
    expect(html).toContain("This is a my fancy tagline.");
    expect(html).toContain("background:#1a1a2e");
    expect(html).toContain("border-top: 4px solid #1a1a2e");
  });
});
