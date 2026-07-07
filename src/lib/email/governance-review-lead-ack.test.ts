import { describe, expect, it } from "vitest";
import { renderGovernanceReviewLeadAckEmailHtml } from "@/lib/email/governance-review-lead-ack";

describe("renderGovernanceReviewLeadAckEmailHtml", () => {
  it("includes the submitter name and confirmation copy", () => {
    const html = renderGovernanceReviewLeadAckEmailHtml({
      name: "Jordan Smith",
      email: "jordan@example.com",
    });

    expect(html).toContain("Hi Jordan");
    expect(html).toContain("We received your assessment request");
    expect(html).toContain("jordan@example.com");
    expect(html).toContain("not the full intake");
  });
});
