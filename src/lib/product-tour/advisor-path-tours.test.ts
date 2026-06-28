import { describe, expect, it } from "vitest";

import { getAdvisorTourIdForPath } from "./advisor-path-tours";

describe("getAdvisorTourIdForPath", () => {
  it("maps settings and methodology routes", () => {
    expect(getAdvisorTourIdForPath("/advisor/settings")).toBe("advisor-settings");
    expect(getAdvisorTourIdForPath("/advisor/methodology")).toBe(
      "advisor-methodology-hub",
    );
    expect(getAdvisorTourIdForPath("/advisor/methodology/questions/governance")).toBe(
      "advisor-methodology-questions",
    );
  });

  it("maps pipeline routes", () => {
    expect(getAdvisorTourIdForPath("/advisor/pipeline")).toBe("advisor-pipeline");
    expect(getAdvisorTourIdForPath("/advisor/pipeline/client-123")).toBe(
      "advisor-pipeline-client",
    );
  });

  it("returns null for routes without a configured tour", () => {
    expect(getAdvisorTourIdForPath("/advisor/leads")).toBe("advisor-leads");
    expect(getAdvisorTourIdForPath("/advisor")).toBeNull();
  });

  it("falls back to workspace tour for unmatched advisor sub-routes", () => {
    expect(getAdvisorTourIdForPath("/advisor/question-bank/abc")).toBe(
      "advisor-workspace-fallback",
    );
  });
});
