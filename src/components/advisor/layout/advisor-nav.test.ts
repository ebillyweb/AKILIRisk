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
  partitionAdvisorNavSections,
} from "./advisor-nav";

const flags = {
  governanceDashboardEnabled: true,
  riskIntelligenceEnabled: true,
  workflowTasksEnabled: false,
  workflowFollowUpsEnabled: false,
  monitoringEnabled: false,
};

describe("getActiveAdvisorNavHref", () => {
  const sections = getVisibleAdvisorNavSections(flags);

  it("highlights Clients on pipeline workflow filter URLs", () => {
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

  it("highlights Sessions on the facilitate launcher", () => {
    expect(getActiveAdvisorNavHref("/advisor/facilitate", sections)).toBe(
      "/advisor/facilitate",
    );
  });

  it("exposes Home section with Overview, Sessions, and Notifications", () => {
    const home = ADVISOR_NAV_SECTIONS.find((s) => s.id === "home");
    expect(home?.title).toBe("Home");
    expect(home?.items.map((item) => item.label)).toEqual([
      "Overview",
      "Sessions",
      "Notifications",
    ]);
    expect(getAdvisorNavSectionForHref(sections, "/advisor/facilitate")).toBe("home");
    expect(getAdvisorNavSectionForHref(sections, "/advisor/notifications")).toBe("home");
  });

  it("exposes Clients section with Clients and Invitations", () => {
    const clients = ADVISOR_NAV_SECTIONS.find((s) => s.id === "clients");
    expect(clients?.title).toBe("Clients");
    expect(clients?.items.map((item) => item.label)).toEqual([
      "Clients",
      "Invitations",
    ]);
  });

  it("exposes Firm section with team, access, standards, and billing", () => {
    const firm = ADVISOR_NAV_SECTIONS.find((s) => s.id === "firm");
    expect(firm?.title).toBe("Firm");
    expect(firm?.items.map((item) => item.label)).toEqual([
      "Brand",
      "Team",
      "Roles & Permissions",
      "Practice Standards",
      "Billing",
    ]);
    const { footer } = partitionAdvisorNavSections(sections);
    expect(footer).toHaveLength(1);
    expect(footer[0]?.id).toBe("practice");
    expect(footer[0]?.items.map((item) => item.label)).toEqual(["Your methodology"]);
  });

  it("highlights Notifications on notification settings routes", () => {
    const sections = getVisibleAdvisorNavSections(flags);
    expect(getActiveAdvisorNavHref("/advisor/settings/notifications", sections)).toBe(
      "/advisor/notifications",
    );
  });

  it("shows Brand nav only when branding access is enabled", () => {
    const hidden = getVisibleAdvisorNavSections(flags);
    expect(
      hidden.flatMap((section) => section.items).some((item) => item.href === "/advisor/settings/branding"),
    ).toBe(false);

    const visible = getVisibleAdvisorNavSections(flags, { brandingNavEnabled: true });
    expect(
      visible.flatMap((section) => section.items).some((item) => item.href === "/advisor/settings/branding"),
    ).toBe(true);
    expect(getAdvisorNavSectionForHref(visible, "/advisor/settings/branding")).toBe("firm");
  });

  it("shows Team nav only when enterprise team management is enabled", () => {
    const hidden = getVisibleAdvisorNavSections(flags);
    expect(hidden.flatMap((section) => section.items).some((item) => item.label === "Team")).toBe(
      false,
    );

    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    expect(
      visible.flatMap((section) => section.items).some((item) => item.href === "/advisor/settings/team"),
    ).toBe(true);
    expect(
      visible.flatMap((section) => section.items).some((item) => item.href === "/advisor/settings/access-control"),
    ).toBe(true);
    expect(getAdvisorNavSectionForHref(visible, "/advisor/settings/team")).toBe("firm");
    expect(getAdvisorNavSectionForHref(visible, "/advisor/settings/access-control")).toBe("firm");
  });

  it("shows Your methodology in the footer for solo advisors", () => {
    const visible = getVisibleAdvisorNavSections(flags);
    const { footer } = partitionAdvisorNavSections(visible);
    expect(footer.some((section) => section.id === "practice")).toBe(true);
    expect(
      footer
        .flatMap((section) => section.items)
        .some((item) => item.href === "/advisor/methodology"),
    ).toBe(true);
  });

  it("shows Your methodology for enterprise team members when firm toggle is on", () => {
    const visible = getVisibleAdvisorNavSections(flags, {
      applyEnterpriseMemberVisibility: true,
      enterpriseMemberVisibility: { methodology: true },
    });
    const { footer } = partitionAdvisorNavSections(visible);
    expect(
      footer
        .flatMap((section) => section.items)
        .some((item) => item.href === "/advisor/methodology"),
    ).toBe(true);
  });

  it("hides Your methodology for enterprise team members when firm toggle is off", () => {
    const visible = getVisibleAdvisorNavSections(flags, {
      applyEnterpriseMemberVisibility: true,
      enterpriseMemberVisibility: { methodology: false },
    });
    expect(
      visible
        .flatMap((section) => section.items)
        .some((item) => item.href === "/advisor/methodology"),
    ).toBe(false);
  });

  it("hides Your methodology for enterprise team managers who use Practice Standards", () => {
    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    expect(
      visible
        .flatMap((section) => section.items)
        .some((item) => item.href === "/advisor/methodology"),
    ).toBe(false);
    expect(
      visible
        .flatMap((section) => section.items)
        .some((item) => item.href === "/advisor/enterprise/methodology"),
    ).toBe(true);
  });

  it("highlights Your methodology on advisor methodology routes", () => {
    const visible = getVisibleAdvisorNavSections(flags);
    expect(getActiveAdvisorNavHref("/advisor/methodology/questions/governance", visible)).toBe(
      "/advisor/methodology",
    );
  });

  it("shows Practice Standards for enterprise team managers when team nav is enabled", () => {
    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    const practiceStandards = visible
      .flatMap((section) => section.items)
      .find((item) => item.href === "/advisor/enterprise/methodology");
    expect(practiceStandards?.label).toBe("Practice Standards");
    expect(getAdvisorNavSectionForHref(visible, "/advisor/enterprise/methodology")).toBe("firm");
  });

  it("shows Billing in Firm for advisors with billing access", () => {
    const solo = getVisibleAdvisorNavSections(flags);
    expect(getAdvisorNavSectionForHref(solo, "/advisor/billing")).toBe("firm");
    expect(
      solo.find((section) => section.id === "firm")?.items.some((item) => item.href === "/advisor/billing"),
    ).toBe(true);

    const enterprise = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    expect(getAdvisorNavSectionForHref(enterprise, "/advisor/billing")).toBe("firm");
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

  it("marks Practice Standards as tier locked below the required module tier", () => {
    const practiceStandards = ADVISOR_NAV_SECTIONS.find((s) => s.id === "firm")?.items.find(
      (item) => item.href === "/advisor/enterprise/methodology",
    );
    expect(practiceStandards?.requiresTierFeature).toBe("METHODOLOGY_CUSTOMIZATION");
    expect(isAdvisorNavItemTierLocked(practiceStandards!, "ESSENTIALS")).toBe(true);
    expect(isAdvisorNavItemTierLocked(practiceStandards!, "PROFESSIONAL")).toBe(false);
  });

  it("hides nav sections when every visible item is tier locked", () => {
    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    const filtered = filterAdvisorNavSectionsWithAccessibleItems(visible, "ESSENTIALS", null);
    expect(filtered.some((section) => section.id === "firm")).toBe(true);
    expect(filtered.some((section) => section.id === "clients")).toBe(true);
  });

  it("removes tier-locked nav items when hide policy is enabled", () => {
    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    const filtered = filterTierLockedAdvisorNavItems(visible, "ESSENTIALS");
    const firmItems = filtered.find((section) => section.id === "firm")?.items ?? [];
    expect(firmItems.some((item) => item.href === "/advisor/enterprise/methodology")).toBe(false);
    expect(firmItems.some((item) => item.href === "/advisor/billing")).toBe(true);
  });

  it("resolveAdvisorNavSectionsForDisplay hides tier-locked items when requested", () => {
    const visible = getVisibleAdvisorNavSections(flags, { enterpriseTeamEnabled: true });
    const displayed = resolveAdvisorNavSectionsForDisplay(visible, "ESSENTIALS", null, {
      hideTierLockedItems: true,
    });
    expect(
      displayed.some((section) =>
        section.items.some((item) => item.href === "/advisor/enterprise/methodology"),
      ),
    ).toBe(false);
    expect(
      displayed.some((section) =>
        section.items.some((item) => item.href === "/advisor/billing"),
      ),
    ).toBe(true);
  });

  it("highlights Clients on client detail routes", () => {
    expect(getActiveAdvisorNavHref("/advisor/pipeline/client-1", sections)).toBe(
      "/advisor/pipeline",
    );
  });

  it("highlights Clients on client guidance routes", () => {
    expect(
      getActiveAdvisorNavHref("/advisor/clients/client-1/guidance", sections),
    ).toBe("/advisor/pipeline");
  });

  it("highlights Clients on intake review routes", () => {
    expect(getActiveAdvisorNavHref("/advisor/review/intake-1", sections)).toBe(
      "/advisor/pipeline",
    );
  });

  it("highlights Clients on assessment review routes", () => {
    expect(
      getActiveAdvisorNavHref(
        "/advisor/pipeline/client-1/assessment/asmt-1",
        sections,
      ),
    ).toBe("/advisor/pipeline");
  });

  it("highlights Practice Standards on enterprise recommendation routes", () => {
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
