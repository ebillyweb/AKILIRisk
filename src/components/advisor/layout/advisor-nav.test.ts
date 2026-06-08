import { describe, expect, it } from "vitest";
import {
  ADVISOR_NAV_SECTIONS,
  getActiveAdvisorNavHref,
  getVisibleAdvisorNavSections,
} from "./advisor-nav";

const flags = {
  governanceDashboardEnabled: true,
  riskIntelligenceEnabled: true,
};

describe("getActiveAdvisorNavHref", () => {
  const sections = getVisibleAdvisorNavSections(flags);

  it("highlights intake when awaitingReview filter is active", () => {
    expect(
      getActiveAdvisorNavHref("/advisor/pipeline", sections, {
        awaitingReview: "1",
      })
    ).toBe("/advisor/pipeline?awaitingReview=1");
  });

  it("highlights document requests when documentsNeeded filter is active", () => {
    expect(
      getActiveAdvisorNavHref("/advisor/pipeline", sections, {
        documentsNeeded: "1",
      })
    ).toBe("/advisor/pipeline?documentsNeeded=1");
  });

  it("does not highlight filtered workflow links on client detail routes", () => {
    const active = getActiveAdvisorNavHref("/advisor/pipeline/client-1", sections, {
      awaitingReview: "1",
    });
    expect(active).not.toBe("/advisor/pipeline?awaitingReview=1");
    expect(active).not.toBe("/advisor/pipeline?documentsNeeded=1");
  });

  it("falls back to bare pipeline link when no workflow query is set", () => {
    expect(getActiveAdvisorNavHref("/advisor/pipeline", sections, {})).toBe(
      "/advisor/pipeline"
    );
  });

  it("highlights engagements on the engagements list", () => {
    expect(getActiveAdvisorNavHref("/advisor/engagements", sections)).toBe(
      "/advisor/engagements"
    );
  });

  it("workflow nav items use filtered pipeline hrefs", () => {
    const workflows = ADVISOR_NAV_SECTIONS.find((s) => s.id === "workflows");
    expect(workflows?.items[0]?.href).toBe("/advisor/pipeline?awaitingReview=1");
    expect(workflows?.items[1]?.href).toBe("/advisor/pipeline?documentsNeeded=1");
    expect(workflows?.items[2]?.href).toBe("/advisor/pipeline?needsRescore=1");
    expect(workflows?.items[3]?.href).toBe("/advisor/engagements");
  });
});
