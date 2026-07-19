import { describe, it, expect } from "vitest";
import { renderContactFormEmailHtml } from "./contact-form";

describe("renderContactFormEmailHtml", () => {
  it("escapes user-controlled fields", () => {
    const html = renderContactFormEmailHtml({
      name: `<script>alert(1)</script>`,
      email: `evil@example.com"><script>`,
      subject: `<b>bold</b>`,
      message: `<a href="https://evil">click</a>`,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain('<a href="https://evil">click</a>');
    expect(html).toContain("&lt;a href=&quot;https://evil&quot;&gt;");
    expect(html).not.toContain("mailto:");
  });
});
