import { describe, expect, it } from "vitest";

import { isEnterpriseLinkedAdvisor } from "./advisor-list-filters";

describe("isEnterpriseLinkedAdvisor", () => {
  it("returns true when the advisor profile is linked to a firm", () => {
    expect(
      isEnterpriseLinkedAdvisor({
        advisorProfile: { enterpriseId: "ent-1" },
        enterpriseMembership: null,
      }),
    ).toBe(true);
  });

  it("returns true when only enterprise membership exists", () => {
    expect(
      isEnterpriseLinkedAdvisor({
        advisorProfile: { enterpriseId: null },
        enterpriseMembership: { status: "ACTIVE" },
      }),
    ).toBe(true);
  });

  it("returns false for solo advisors", () => {
    expect(
      isEnterpriseLinkedAdvisor({
        advisorProfile: { enterpriseId: null },
        enterpriseMembership: null,
      }),
    ).toBe(false);
  });
});
