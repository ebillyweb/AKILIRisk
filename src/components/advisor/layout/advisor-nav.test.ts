import { describe, expect, it } from "vitest";
import {
  ADVISOR_NAV_SECTIONS,
  getActiveAdvisorNavHref,
  getAdvisorNavSectionForHref,
  getAdvisorNavItemLockReason,
  getVisibleAdvisorNavSections,
  filterAdvisorNavSectionsWithAccessibleItems,
  filterTierLockedAdvisorNavItems,
  resolveAdvisorNavSectionsForDisplay,
  isAdvisorNavItemTierLocked,
  isAdvisorNavItemClientLimitLocked,
  getAdvisorNavItemLockReason,
  partitionAdvisorNavSections,
} from "./advisor-nav";

const flags = {
  governanceDashboardEnabled: true,
  riskIntelligenceEnabled: true,
  workflowTasksEnabled: false,
  workflowFollowUpsEnabled: false,
};

describe("getActiveAdvisorNavHref", () => {
  const sections = getVisibleAdvisorNavSections(flags);

  it("highlights All clients on pipeline workflow filter URLs", () => {
    expect(
      getActiveAdvisorNavHref("/advisor/pipeline", sections, {
        awaitingReview: "1",
      }),
    ).toBe("/advisor/pipeline");
    expect(
      getActiveAdvisorNavHref("/advisor/pipeline", sections, {
        assessmentInProgress: "1",
      }),
    ).toBe("/advisor/pipeline");
    expect(
      getActiveAdvisorNavHref("/advisor/pipeline", sections, {
        documentsNeeded: "1",
      }),
    ).toBe("/advisor/pipeline");
  });

  it("falls back to bare pipeline link when no workflow query is set", () => {
    expect(getActiveAdvisorNavHref("/advisor/pipeline", sections, {})).toBe(
      "/advisor/pipeline",
    );
  });

  it("highlights engagements on the engagements list", () => {
    expect(getActiveAdvisorNavHref("/advisor/engagements", sections)).toBe(
      "/advisor/engagements",
    );
  });

  it("highlights facilitated sessions on the facilitate launcher", () => {
    expect(getActiveAdvisorNavHref("/advisor/facilitate", sections)).toBe(
      "/advisor/facilitate",
    );
  });

  it("exposes Home section with Overview, notifications, and facilitated sessions", () => {
    const home = ADVISOR_NAV_SECTIONS.find((s) => s.id === "home");
    expect(home?.title).toBe("Home");
    expect(home?.items.map((item) => item.label)).toEqual([
      "Overview",
      "Facilitated sessions",
      "Notifications",
    ]);
    expect(getAdvisorNavSectionForHref(sections, "/advisor/facilitate")).toBe("home");
    expect(getAdvisorNavSectionForHref(sections, "/advisor/notifications")).toBe("home");
  });

  it("exposes Portfolio section with analytics, intelligence, and deliverables", () => {
    const portfolio = ADVISOR_NAV_SECTIONS.find((s) => s.id === "portfolio");
    expect(portfolio?.title).toBe("Portfolio");
    expect(portfolio?.items.map((item) => item.label)).toEqual([
      "Risk analytics",
      "Risk intelligence",
      "Reports",
      "Recommendations",
      "Signals",
    ]);
    expect(getAdvisorNavSectionForHref(sections, "/advisor/dashboard")).toBe("portfolio");
    expect(getAdvisorNavSectionForHref(sections, "/advisor/reports")).toBe("portfolio");
  });

  it("exposes Assessment lifecycle section with engagements and reassessment", () => {
    const assessmentLifecycle = ADVISOR_NAV_SECTIONS.find(
      (s) => s.id === "assessment-lifecycle",
    );
    expect(assessmentLifecycle?.title).toBe("Assessment lifecycle");
    expect(assessmentLifecycle?.items.map((item) => item.href)).toEqual([
      "/advisor/engagements",
      "/advisor/reassessment",
    ]);
  });

  it("exposes Account footer section with settings links", () => {
    const account = ADVISOR_NAV_SECTIONS.find((s) => s.id === "account");
    expect(account?.placement).toBe("footer");
    expect(account?.items.map((item) => item.label)).toEqual([
      "Account settings",
      "Your methodology",
      "Billing",
    ]);
    const { footer } = partitionAdvisorNavSections(sections);
    expect(footer.map((section) => section.id)).toEqual(["account"]);
  });

  it("highlights Methodology on nested methodology routes", () => {
    const sections = getVisibleAdvisorNavSections(flags);
    expect(getActiveAdvisorNavHref("/advisor/methodology/pillars", sections)).toBe(
      "/advisor/methodology",
    );
  });

  it("highlights Account settings on nested settings routes except notification settings", () => {
    const sections = getVisibleAdvisorNavSections(flags);
    expect(getActiveAdvisorNavHref("/advisor/settings/pii-policy", sections)).toBe(
      "/advisor/settings",
    );
    expect(getActiveAdvisorNavHref("/advisor/settings/notifications", sections)).toBe(
      "/advisor/notifications",
    );
  });

  it("shows Team nav only when enterprise team management is enabled", () => {
    const hidden = getVisibleAdvisorNavSections(flags);
    expect(hidden.flatMap((section) => section.items).some((item) => item.label === "Team management")).toBe(
      false,
    );

    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    expect(
      visible.flatMap((section) => section.items).some((item) => item.href === "/advisor/settings/team"),
    ).toBe(true);
    expect(getAdvisorNavSectionForHref(visible, "/advisor/settings/team")).toBe("firm");
  });

  it("shows Firm standards for enterprise team managers when team nav is enabled", () => {
    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    const firmStandards = visible
      .flatMap((section) => section.items)
      .find((item) => item.href === "/advisor/enterprise/methodology");
    expect(firmStandards?.label).toBe("Firm standards");
    expect(getAdvisorNavSectionForHref(visible, "/advisor/enterprise/methodology")).toBe("firm");
  });

  it("hides Engagements when implementation tracking is disabled for the firm", () => {
    const withTracking = getVisibleAdvisorNavSections(flags);
    expect(
      withTracking.flatMap((section) => section.items).some((item) => item.href === "/advisor/engagements"),
    ).toBe(true);

    const withoutTracking = getVisibleAdvisorNavSections(flags, {
      implementationTrackingEnabled: false,
    });
    expect(
      withoutTracking.flatMap((section) => section.items).some((item) => item.href === "/advisor/engagements"),
    ).toBe(false);
    expect(
      withoutTracking.flatMap((section) => section.items).some((item) => item.href === "/advisor/reassessment"),
    ).toBe(true);
  });

  it("moves Billing to Firm for enterprise team managers", () => {
    const solo = getVisibleAdvisorNavSections(flags);
    expect(getAdvisorNavSectionForHref(solo, "/advisor/billing")).toBe("account");

    const enterprise = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    expect(getAdvisorNavSectionForHref(enterprise, "/advisor/billing")).toBe("firm");
    expect(
      enterprise.find((section) => section.id === "account")?.items.some((item) => item.href === "/advisor/billing"),
    ).toBe(false);
    expect(
      enterprise.find((section) => section.id === "firm")?.items.some((item) => item.href === "/advisor/billing"),
    ).toBe(true);
  });

  it("hides portfolio nav for enterprise members when firm visibility is off", () => {
    const visible = getVisibleAdvisorNavSections(flags, {
      applyEnterpriseMemberVisibility: true,
      enterpriseMemberVisibility: {
        portfolio: false,
        methodology: true,
        engagements: true,
        reassessment: true,
        productTours: true,
        hideTierLockedNav: false,
      },
    });
    const portfolioItems = visible.find((section) => section.id === "portfolio")?.items ?? [];
    expect(portfolioItems).toHaveLength(0);
    expect(visible.some((section) => section.id === "portfolio")).toBe(false);
  });

  it("hides methodology nav for enterprise members when firm visibility is off", () => {
    const visible = getVisibleAdvisorNavSections(flags, {
      applyEnterpriseMemberVisibility: true,
      enterpriseMemberVisibility: {
        portfolio: true,
        methodology: false,
        engagements: true,
        reassessment: true,
        productTours: true,
        hideTierLockedNav: false,
      },
    });
    const accountItems = visible.find((section) => section.id === "account")?.items ?? [];
    expect(accountItems.some((item) => item.href === "/advisor/methodology")).toBe(false);
  });

  it("hides Billing nav when billing access is disabled for enterprise advisors", () => {
    const withBilling = getVisibleAdvisorNavSections(flags);
    expect(
      withBilling.flatMap((section) => section.items).some((item) => item.href === "/advisor/billing"),
    ).toBe(true);

    const withoutBilling = getVisibleAdvisorNavSections(flags, { billingNavEnabled: false });
    expect(
      withoutBilling.flatMap((section) => section.items).some((item) => item.href === "/advisor/billing"),
    ).toBe(false);
  });

  it("marks tier-gated nav items as locked below the required module tier", () => {
    const methodology = ADVISOR_NAV_SECTIONS.find((s) => s.id === "account")?.items.find(
      (item) => item.href === "/advisor/methodology",
    );
    expect(methodology?.requiresTierFeature).toBe("METHODOLOGY_CUSTOMIZATION");
    expect(isAdvisorNavItemTierLocked(methodology!, "ESSENTIALS")).toBe(true);
    expect(isAdvisorNavItemTierLocked(methodology!, "PROFESSIONAL")).toBe(false);

    const engagements = ADVISOR_NAV_SECTIONS.find((s) => s.id === "assessment-lifecycle")?.items.find(
      (item) => item.href === "/advisor/engagements",
    );
    expect(isAdvisorNavItemTierLocked(engagements!, "PROFESSIONAL")).toBe(true);
    expect(isAdvisorNavItemTierLocked(engagements!, "BUSINESS")).toBe(false);
  });

  it("hides nav sections when every visible item is tier locked", () => {
    const visible = getVisibleAdvisorNavSections(flags);
    const filtered = filterAdvisorNavSectionsWithAccessibleItems(visible, "ESSENTIALS", null);
    expect(filtered.some((section) => section.id === "assessment-lifecycle")).toBe(false);
    expect(filtered.some((section) => section.id === "clients")).toBe(true);
  });

  it("keeps nav sections when at least one item is accessible", () => {
    const visible = getVisibleAdvisorNavSections(flags);
    const filtered = filterAdvisorNavSectionsWithAccessibleItems(visible, "BUSINESS", null);
    expect(filtered.some((section) => section.id === "assessment-lifecycle")).toBe(true);
  });

  it("removes tier-locked nav items when hide policy is enabled", () => {
    const visible = getVisibleAdvisorNavSections(flags);
    const filtered = filterTierLockedAdvisorNavItems(visible, "ESSENTIALS");
    const accountItems = filtered.find((section) => section.id === "account")?.items ?? [];
    expect(accountItems.some((item) => item.href === "/advisor/methodology")).toBe(false);
    const portfolioItems = filtered.find((section) => section.id === "portfolio")?.items ?? [];
    expect(portfolioItems.some((item) => item.href === "/advisor/dashboard")).toBe(false);
    expect(portfolioItems.some((item) => item.href === "/advisor/reports")).toBe(true);
  });

  it("resolveAdvisorNavSectionsForDisplay hides tier-locked items when requested", () => {
    const visible = getVisibleAdvisorNavSections(flags);
    const displayed = resolveAdvisorNavSectionsForDisplay(visible, "PROFESSIONAL", null, {
      hideTierLockedItems: true,
    });
    expect(
      displayed.some((section) =>
        section.items.some((item) => item.href === "/advisor/engagements"),
      ),
    ).toBe(false);
    expect(
      displayed.some((section) =>
        section.items.some((item) => item.href === "/advisor/methodology"),
      ),
    ).toBe(true);
  });

  it("highlights All clients on client detail routes", () => {
    expect(getActiveAdvisorNavHref("/advisor/pipeline/client-1", sections)).toBe(
      "/advisor/pipeline",
    );
  });

  it("highlights All clients on client guidance routes", () => {
    expect(
      getActiveAdvisorNavHref("/advisor/clients/client-1/guidance", sections),
    ).toBe("/advisor/pipeline");
  });

  it("highlights All clients on intake review routes", () => {
    expect(getActiveAdvisorNavHref("/advisor/review/intake-1", sections)).toBe(
      "/advisor/pipeline",
    );
  });

  it("highlights All clients on assessment review routes", () => {
    expect(
      getActiveAdvisorNavHref(
        "/advisor/pipeline/client-1/assessment/asmt-1",
        sections,
      ),
    ).toBe("/advisor/pipeline");
  });

  it("highlights Risk intelligence on family intelligence routes", () => {
    expect(getActiveAdvisorNavHref("/advisor/intelligence/family-1", sections)).toBe(
      "/advisor/intelligence",
    );
  });

  it("highlights Risk analytics on client analytics routes", () => {
    expect(getActiveAdvisorNavHref("/advisor/analytics/client-1", sections)).toBe(
      "/advisor/dashboard",
    );
  });

  it("highlights Firm standards on enterprise recommendation routes", () => {
    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    expect(
      getActiveAdvisorNavHref("/advisor/enterprise/recommendations/governance", visible),
    ).toBe("/advisor/enterprise/methodology");
  });

  it("highlights Overview only on the advisor home route", () => {
    expect(getActiveAdvisorNavHref("/advisor", sections)).toBe("/advisor");
    expect(getActiveAdvisorNavHref("/advisor/pipeline", sections, {})).toBe(
      "/advisor/pipeline",
    );
  });

  it("highlights Notifications on the notifications inbox", () => {
    expect(getActiveAdvisorNavHref("/advisor/notifications", sections)).toBe(
      "/advisor/notifications",
    );
  });

  it("locks invitations when the advisor is at their client cap", () => {
    const invitations = ADVISOR_NAV_SECTIONS.find((s) => s.id === "clients")?.items.find(
      (item) => item.href === "/advisor/invitations",
    );
    const status = {
      canAddClient: false,
      currentCount: 25,
      limit: 25,
      currentTier: "ESSENTIALS" as const,
      suggestedUpgradeTier: "PROFESSIONAL" as const,
      isEnterprise: false,
      canSelfServeUpgrade: true,
    };
    expect(isAdvisorNavItemClientLimitLocked(invitations!, status)).toBe(true);
    expect(
      getAdvisorNavItemLockReason(invitations!, "ESSENTIALS", status),
    ).toEqual({ type: "client-limit" });
  });
});
