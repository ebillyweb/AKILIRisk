import { describe, expect, it } from "vitest";
import {
  ADVISOR_NAV_SECTIONS,
  getActiveAdvisorNavHref,
  getAdvisorNavSectionForHref,
  getVisibleAdvisorNavSections,
} from "./advisor-nav";

const flags = {
  governanceDashboardEnabled: true,
  riskIntelligenceEnabled: true,
  workflowTasksEnabled: false,
  workflowFollowUpsEnabled: false,
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

  it("highlights Risk Assessment on the facilitate launcher", () => {
    expect(getActiveAdvisorNavHref("/advisor/facilitate", sections)).toBe(
      "/advisor/facilitate"
    );
  });

  it("workflow nav items use filtered pipeline hrefs", () => {
    const workflows = ADVISOR_NAV_SECTIONS.find((s) => s.id === "workflows");
    expect(workflows?.items[0]?.href).toBe("/advisor/pipeline?awaitingReview=1");
    expect(workflows?.items[1]?.href).toBe("/advisor/facilitate");
    expect(workflows?.items[2]?.href).toBe("/advisor/pipeline?documentsNeeded=1");
    expect(workflows?.items[3]?.href).toBe("/advisor/pipeline?needsRescore=1");
    expect(workflows?.items[4]?.href).toBe("/advisor/engagements");
  });

  it("exposes Configuration section with methodology and settings", () => {
    const config = ADVISOR_NAV_SECTIONS.find((s) => s.id === "configuration");
    expect(config?.title).toBe("Configuration");
    const hrefs = config?.items.map((item) => item.href) ?? [];
    expect(hrefs).toContain("/advisor/methodology");
    expect(hrefs).toContain("/advisor/settings");
    expect(hrefs).toContain("/advisor/settings/notifications");
  });

  it("highlights Methodology on nested methodology routes", () => {
    const sections = getVisibleAdvisorNavSections(flags);
    expect(getActiveAdvisorNavHref("/advisor/methodology/pillars", sections)).toBe(
      "/advisor/methodology",
    );
  });

  it("highlights Settings on nested settings routes except notification preferences", () => {
    const sections = getVisibleAdvisorNavSections(flags);
    expect(getActiveAdvisorNavHref("/advisor/settings/pii-policy", sections)).toBe(
      "/advisor/settings",
    );
    expect(getActiveAdvisorNavHref("/advisor/settings/notifications", sections)).toBe(
      "/advisor/settings/notifications",
    );
  });

  it("hides Tasks and Follow-ups until workflow feature flags are enabled", () => {
    const hidden = getVisibleAdvisorNavSections(flags);
    const workflowItems = hidden.find((s) => s.id === "workflows")?.items ?? [];
    expect(workflowItems.some((item) => item.label === "Tasks")).toBe(false);
    expect(workflowItems.some((item) => item.label === "Follow-ups")).toBe(false);

    const visible = getVisibleAdvisorNavSections({
      ...flags,
      workflowTasksEnabled: true,
      workflowFollowUpsEnabled: true,
    });
    const enabledItems = visible.find((s) => s.id === "workflows")?.items ?? [];
    expect(enabledItems.some((item) => item.label === "Tasks")).toBe(true);
    expect(enabledItems.some((item) => item.label === "Follow-ups")).toBe(true);
  });

  it("shows Team nav only when enterprise team management is enabled", () => {
    const hidden = getVisibleAdvisorNavSections(flags);
    expect(
      hidden.flatMap((section) => section.items).some((item) => item.label === "Team")
    ).toBe(false);

    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    expect(
      visible.flatMap((section) => section.items).some((item) => item.href === "/advisor/settings/team")
    ).toBe(true);
    expect(getAdvisorNavSectionForHref(visible, "/advisor/settings/team")).toBe("configuration");
  });

  it("hides Billing nav when billing access is disabled for enterprise advisors", () => {
    const withBilling = getVisibleAdvisorNavSections(flags);
    expect(
      withBilling.flatMap((section) => section.items).some((item) => item.href === "/advisor/billing")
    ).toBe(true);

    const withoutBilling = getVisibleAdvisorNavSections(flags, { billingNavEnabled: false });
    expect(
      withoutBilling.flatMap((section) => section.items).some((item) => item.href === "/advisor/billing")
    ).toBe(false);
  });
});
