import { describe, it, expect } from "vitest";
import {
  renderAdvisorIntakeNotificationHtml,
  renderPasswordResetEmailHtml,
} from "./email";

/**
 * Round-6 regression: client display names flowed unescaped into the
 * "advisor: new intake ready" email body. A client could pick a display
 * name containing HTML (`<a href="https://evil/phish">…</a>`) and it would
 * render as legitimate clickable content inside an Akili Risk-branded email
 * to their advisor.
 *
 * These tests pin the rendered HTML for the user-controlled fields. They
 * test the renderer directly so we don't have to mock Resend.
 */
describe("renderAdvisorIntakeNotificationHtml", () => {
  const xss = `<script>alert(1)</script>`;
  const phish = `<a href="https://evil.example/phish">Click here</a>`;

  it("escapes a client display name containing <script>", () => {
    const html = renderAdvisorIntakeNotificationHtml(
      "Advisor",
      xss,
      "client@example.com",
      "https://app.example/advisor/review/abc"
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes a client display name containing a phishing anchor", () => {
    const html = renderAdvisorIntakeNotificationHtml(
      "Advisor",
      phish,
      "client@example.com",
      "https://app.example/advisor/review/abc"
    );
    // The literal anchor tag must NOT appear — it would render as a real link.
    expect(html).not.toContain('<a href="https://evil.example/phish">Click here</a>');
    // The escaped form must appear.
    expect(html).toContain("&lt;a href=&quot;https://evil.example/phish&quot;&gt;");
  });

  it("escapes an advisor display name containing HTML", () => {
    const html = renderAdvisorIntakeNotificationHtml(
      xss,
      "Client",
      "client@example.com",
      "https://app.example/advisor/review/abc"
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("does not over-escape benign names", () => {
    const html = renderAdvisorIntakeNotificationHtml(
      "Advisor Name",
      "Client Name",
      "client@example.com",
      "https://app.example/advisor/review/abc"
    );
    expect(html).toContain("Hello Advisor Name,");
    expect(html).toContain("<strong>Client Name</strong>");
  });
});

describe("renderPasswordResetEmailHtml", () => {
  it("escapes a reset URL with HTML metacharacters", () => {
    // Reset URLs are server-built so a malicious URL shouldn't reach this
    // function in practice, but the renderer should still escape so a future
    // env-var injection or refactor doesn't open an XSS hole.
    const html = renderPasswordResetEmailHtml(
      `https://app.example/reset?token=abc"onmouseover="alert(1)`
    );
    expect(html).not.toContain('"onmouseover="');
    expect(html).toContain("&quot;onmouseover=&quot;");
  });
});
