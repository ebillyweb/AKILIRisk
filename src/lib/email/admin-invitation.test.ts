import { describe, expect, it } from "vitest";
import { PLATFORM_EMAIL_LOGO_CID } from "@/lib/email/platform-email-logo";
import { renderAdminInvitationHtml } from "./admin-invitation";

describe("renderAdminInvitationHtml", () => {
  const base = {
    name: "Pat Admin",
    email: "pat@example.com",
    role: "Administrator",
    tempPassword: "plain-pass",
    loginUrl: "https://preview.akilirisk.com/signin",
    invitedBy: "Super Admin",
  };

  it("escapes passwords containing HTML-significant characters", () => {
    const html = renderAdminInvitationHtml({
      ...base,
      tempPassword: 'a&b<c>"d',
    });
    expect(html).not.toContain('a&b<c>"d');
    expect(html).toContain("a&amp;b&lt;c&gt;&quot;d");
  });

  it("includes the staging login URL in the sign-in link", () => {
    const html = renderAdminInvitationHtml(base);
    expect(html).toContain('href="https://preview.akilirisk.com/signin"');
  });

  it("uses the inline CID logo and brand header", () => {
    const html = renderAdminInvitationHtml(base);
    expect(html).toContain(`cid:${PLATFORM_EMAIL_LOGO_CID}`);
    expect(html).not.toContain("linear-gradient(135deg, #1e40af");
    expect(html).toContain("Sign in to AKILI");
  });
});
