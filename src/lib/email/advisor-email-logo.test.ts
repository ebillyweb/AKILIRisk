import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResendEmailPayload } from "@/lib/email/resend-payload";
import {
  ADVISOR_EMAIL_LOGO_CID,
  appendAdvisorLogoAttachment,
  hasAdvisorEmailLogo,
  resolveAdvisorEmailLogo,
} from "./advisor-email-logo";

const getBrandingLogoObjectBytes = vi.fn();

vi.mock("@/lib/s3/branding-uploads", () => ({
  getBrandingLogoObjectBytes: (...args: unknown[]) => getBrandingLogoObjectBytes(...args),
}));

describe("advisor email logo", () => {
  beforeEach(() => {
    getBrandingLogoObjectBytes.mockReset();
  });

  it("detects private S3 logos by key or URL", () => {
    expect(
      hasAdvisorEmailLogo({
        logoS3Key: "advisors/adv-1/logos/logo.png",
      })
    ).toBe(true);

    expect(
      hasAdvisorEmailLogo({
        logoUrl:
          "https://akili-advisor-assets.s3.us-east-2.amazonaws.com/advisors/adv-1/logos/logo.png",
      })
    ).toBe(true);
  });

  it("detects public HTTPS logos", () => {
    expect(
      hasAdvisorEmailLogo({
        logoUrl: "https://cdn.example.com/logo.png",
      })
    ).toBe(true);
  });

  it("embeds private S3 logos as CID attachments", async () => {
    getBrandingLogoObjectBytes.mockResolvedValue({
      data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      contentType: "image/png",
    });

    const resolved = await resolveAdvisorEmailLogo({
      logoS3Key: "advisors/adv-1/logos/logo.png",
    });

    expect(resolved).toEqual({
      src: `cid:${ADVISOR_EMAIL_LOGO_CID}`,
      attachment: {
        content: Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64"),
        filename: "advisor-logo.png",
        contentId: ADVISOR_EMAIL_LOGO_CID,
      },
    });
    expect(getBrandingLogoObjectBytes).toHaveBeenCalledWith(
      "advisors/adv-1/logos/logo.png"
    );
  });

  it("uses public HTTPS URLs without attachments", async () => {
    const resolved = await resolveAdvisorEmailLogo({
      logoUrl: "https://cdn.example.com/logo.png",
    });

    expect(resolved).toEqual({
      src: "https://cdn.example.com/logo.png",
      attachment: null,
    });
    expect(getBrandingLogoObjectBytes).not.toHaveBeenCalled();
  });

  it("returns null when S3 fetch fails", async () => {
    getBrandingLogoObjectBytes.mockRejectedValue(new Error("NoSuchKey"));

    const resolved = await resolveAdvisorEmailLogo({
      logoS3Key: "advisors/adv-1/logos/missing.png",
    });

    expect(resolved).toBeNull();
  });

  it("adds the advisor logo attachment when provided", () => {
    const payload = appendAdvisorLogoAttachment(
      {
        html: `<img src="cid:${ADVISOR_EMAIL_LOGO_CID}" />`,
        to: "a@b.com",
      } as ResendEmailPayload,
      {
        content: "abc",
        filename: "advisor-logo.png",
        contentId: ADVISOR_EMAIL_LOGO_CID,
      }
    ) as { attachments?: Array<{ contentId?: string }> };

    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments?.[0]?.contentId).toBe(ADVISOR_EMAIL_LOGO_CID);
  });
});
