import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getSupportTicketRecipientEmail,
  renderSupportTicketEmailHtml,
} from "./support-ticket";

describe("renderSupportTicketEmailHtml", () => {
  it("escapes user-controlled fields and includes category", () => {
    const html = renderSupportTicketEmailHtml({
      name: `<script>alert(1)</script>`,
      email: `evil@example.com"><script>`,
      category: "technical",
      subject: `<b>bold</b>`,
      message: `<a href="https://evil">click</a>`,
      userId: "user_123",
      userRole: "USER",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain('<a href="https://evil">click</a>');
    expect(html).toContain("Technical issue");
    expect(html).toContain("user_123");
    expect(html).not.toContain("mailto:");
  });

  it("mentions an attached image when present", () => {
    const html = renderSupportTicketEmailHtml({
      name: "Ada",
      email: "ada@example.com",
      category: "other",
      subject: "Help",
      message: "See the attached screenshot of the document.",
      userId: "user_1",
      userRole: "USER",
      attachment: {
        filename: "doc-shot.png",
        contentType: "image/png",
        contentBase64: "aaaa",
      },
    });
    expect(html).toContain("doc-shot.png");
    expect(html).toContain("An image attachment is included");
  });
});

describe("getSupportTicketRecipientEmail", () => {
  const original = process.env.SUPPORT_TICKET_TO_EMAIL;

  beforeEach(() => {
    delete process.env.SUPPORT_TICKET_TO_EMAIL;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SUPPORT_TICKET_TO_EMAIL;
    } else {
      process.env.SUPPORT_TICKET_TO_EMAIL = original;
    }
  });

  it("defaults to support@akilirisk.com", () => {
    expect(getSupportTicketRecipientEmail()).toBe("support@akilirisk.com");
  });

  it("uses SUPPORT_TICKET_TO_EMAIL when set", () => {
    process.env.SUPPORT_TICKET_TO_EMAIL = "ops@example.com";
    expect(getSupportTicketRecipientEmail()).toBe("ops@example.com");
  });
});
