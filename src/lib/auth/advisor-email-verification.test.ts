import { describe, expect, it } from "vitest";

import {
  advisorEmailVerifyIdentifier,
  emailFromAdvisorVerifyIdentifier,
} from "@/lib/auth/advisor-email-verification";

describe("advisor email verification identifiers", () => {
  it("round-trips normalized email in identifier", () => {
    const identifier = advisorEmailVerifyIdentifier("Advisor@Firm.com");
    expect(identifier).toBe("advisor-email-verify:advisor@firm.com");
    expect(emailFromAdvisorVerifyIdentifier(identifier)).toBe("advisor@firm.com");
  });

  it("rejects non-advisor identifiers", () => {
    expect(emailFromAdvisorVerifyIdentifier("user@example.com")).toBeNull();
  });
});
