import { describe, expect, it } from "vitest";
import { AKILI_TAGLINES } from "@/lib/brand/tokens";
import { PLATFORM_EMAIL_LOGO_CID } from "@/lib/email/platform-email-logo";
import {
  renderPlatformEmailCta,
  wrapPlatformEmailContent,
} from "@/lib/email/platform-email-layout";

describe("wrapPlatformEmailContent", () => {
  it("references the inline CID logo and brand header", () => {
    const html = wrapPlatformEmailContent({
      documentTitle: "Test",
      bodyHtml: "<p>Body</p>",
    });
    expect(html).toContain(`cid:${PLATFORM_EMAIL_LOGO_CID}`);
    expect(html).toContain(AKILI_TAGLINES.email);
    expect(html).toContain("<p>Body</p>");
  });

  it("escapes CTA hrefs", () => {
    const html = renderPlatformEmailCta({
      label: "Go",
      href: `https://app.test/x"onload="alert(1)`,
    });
    expect(html).not.toContain('"onload="');
    expect(html).toContain("&quot;onload=&quot;");
  });
});
