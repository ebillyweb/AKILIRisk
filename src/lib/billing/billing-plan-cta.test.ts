import { describe, expect, it } from "vitest";

import { billingPlanNavigationLabel } from "./billing-plan-cta";

describe("billingPlanNavigationLabel", () => {
  it("names the target tier when deep-linking to a plan", () => {
    expect(billingPlanNavigationLabel("PROFESSIONAL")).toBe("View Professional plan");
  });

  it("uses generic copy when no tier is specified", () => {
    expect(billingPlanNavigationLabel()).toBe("View plans");
  });
});
