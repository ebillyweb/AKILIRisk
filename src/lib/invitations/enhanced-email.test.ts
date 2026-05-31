import { describe, expect, it } from "vitest";
import { ADVISOR_EMAIL_LOGO_CID } from "@/lib/email/advisor-email-logo";
import { renderEnhancedInvitationTemplate } from "./enhanced-email";

describe("renderEnhancedInvitationTemplate", () => {
  it("embeds private S3 logos via CID instead of raw S3 URLs", () => {
    const html = renderEnhancedInvitationTemplate({
      branding: {
        brandName: "eBilly's WebSolutions",
        tagline: "This is a my fancy tagline.",
        primaryColor: "#1a1a2e",
        secondaryColor: "#dbeafe",
        logoUrl:
          "https://akili-advisor-assets.s3.us-east-2.amazonaws.com/advisors/adv-1/logos/logo.png",
        logoEmailSrc: `cid:${ADVISOR_EMAIL_LOGO_CID}`,
        brandingEnabled: true,
        customDomainEnabled: false,
      },
      personalMessage: "Please complete your assessment.",
      invitationUrl: "https://preview.akilirisk.com/signup?invite=token",
      clientName: "Buddy",
    });

    expect(html).toContain(`cid:${ADVISOR_EMAIL_LOGO_CID}`);
    expect(html).not.toContain("akili-advisor-assets.s3.us-east-2.amazonaws.com");
    expect(html).toContain("eBilly&#039;s WebSolutions");
    expect(html).toContain("This is a my fancy tagline.");
  });
});
