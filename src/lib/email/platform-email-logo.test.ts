import { describe, expect, it } from "vitest";
import {
  PLATFORM_EMAIL_LOGO_CID,
  getPlatformEmailLogoAttachment,
  withPlatformLogoAttachment,
} from "./platform-email-logo";

describe("platform email logo attachment", () => {
  it("loads the lockup PNG for Resend inline embedding", () => {
    const attachment = getPlatformEmailLogoAttachment();
    expect(attachment).not.toBeNull();
    expect(attachment?.contentId).toBe(PLATFORM_EMAIL_LOGO_CID);
    expect(attachment?.filename).toBe("akili-email-lockup.png");
    expect(attachment?.content.length).toBeGreaterThan(1000);
  });

  it("adds the logo attachment when HTML references the CID", () => {
    const payload = withPlatformLogoAttachment({
      html: `<img src="cid:${PLATFORM_EMAIL_LOGO_CID}" />`,
      to: "a@b.com",
    });
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments?.[0]?.contentId).toBe(PLATFORM_EMAIL_LOGO_CID);
  });

  it("does not add an attachment when HTML has no platform logo CID", () => {
    const payload = withPlatformLogoAttachment({
      html: "<p>Hello</p>",
      to: "a@b.com",
    });
    expect(payload.attachments).toBeUndefined();
  });
});
