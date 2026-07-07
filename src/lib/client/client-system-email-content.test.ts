import { describe, expect, it } from "vitest";
import {
  buildMagicLinkEmailContent,
  buildIntakeApprovedEmailContent,
} from "@/lib/email";
import {
  buildPreviewAvailableClientEmail,
  buildAssessmentReminderClientEmail,
} from "@/lib/client/client-system-email-content";
import { renderClientSystemEmailHtml } from "@/lib/email/client-branded-system-email";
import { PLATFORM_EMAIL_TAGLINE } from "@/lib/email/platform-brand";
import type { ClientEmailContext } from "@/lib/client/client-email-context";
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

const brandedContext: ClientEmailContext = {
  userId: "user-1",
  advisorProfileId: "advisor-1",
  branding,
  isBranded: true,
  firmDisplayName: "Independent Wealth Group",
  advisorName: "Alex Advisor",
  portalOrigin: "https://independent-wealth-staging.akilirisk.com",
  usesTenantHost: true,
};

describe("buildMagicLinkEmailContent", () => {
  it("uses advisor firm name when branding is enabled", () => {
    const content = buildMagicLinkEmailContent(
      "https://independent-wealth-staging.akilirisk.com/auth/magic-link/verify?token=abc",
      brandedContext,
      "Buddy",
    );
    expect(content.subject).toContain("Independent Wealth Group");
    expect(content.headline).toContain("Independent Wealth Group");
  });

  it("falls back to platform copy without branding", () => {
    const content = buildMagicLinkEmailContent(
      "https://preview.akilirisk.com/auth/magic-link/verify?token=abc",
      null,
    );
    expect(content.subject).toContain("Akili Risk");
    expect(content.headline).toContain("AKILI");
  });
});

describe("buildIntakeApprovedEmailContent", () => {
  it("omits duplicate greeting in body when branded", () => {
    const content = buildIntakeApprovedEmailContent(
      "Buddy",
      "Independent Wealth Group",
      "https://example.com/verify",
      brandedContext,
    );
    expect(content.bodyHtml).not.toContain("Hello Buddy");
    expect(content.clientName).toBe("Buddy");
    expect(content.bodyHtml).toContain("Independent Wealth Group");
  });
});

describe("buildPreviewAvailableClientEmail", () => {
  it("links to tenant risk preview and names the advisor firm", () => {
    const content = buildPreviewAvailableClientEmail(brandedContext, "Buddy");
    expect(content.cta?.href).toContain("/assessment/risk-preview");
    expect(content.cta?.href).toContain("independent-wealth-staging");
    expect(content.bodyHtml).toContain("Independent Wealth Group");
  });
});

describe("buildAssessmentReminderClientEmail", () => {
  it("uses advisor firm in subject when branded", () => {
    const content = buildAssessmentReminderClientEmail(
      brandedContext,
      "Buddy",
      "https://independent-wealth-staging.akilirisk.com/assessment",
    );
    expect(content.subject).toContain("Independent Wealth Group");
  });

  it("renders with white-label template when branding is enabled", () => {
    const content = buildAssessmentReminderClientEmail(
      brandedContext,
      "Buddy",
      "https://independent-wealth-staging.akilirisk.com/assessment",
    );
    const html = renderClientSystemEmailHtml(content, brandedContext);
    expect(html).toContain("Independent Wealth Group");
    expect(html).not.toContain(PLATFORM_EMAIL_TAGLINE);
  });
});
