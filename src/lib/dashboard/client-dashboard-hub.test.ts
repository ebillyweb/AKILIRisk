import { describe, expect, it } from "vitest";
import {
  buildClientDashboardDestinations,
  buildClientDashboardHeadline,
  buildClientDashboardJourney,
} from "@/lib/dashboard/client-dashboard-hub";

const baseInput = {
  intakeHeroLabel: "Approved",
  intakeWaived: false,
  hasSubmittedInterview: true,
  intakeAnswersLocked: false,
  restrictNavToIntake: false,
  assessmentUnlocked: true,
  assessmentScopePending: false,
  assessmentInProgress: true,
  assessmentComplete: false,
  canViewRiskPreview: false,
  canViewSummary: false,
  canViewActionPlan: false,
  actionPlanEnabled: true,
  responseCount: 12,
  totalQuestions: 100,
  mfaEnabled: false,
};

describe("buildClientDashboardHeadline", () => {
  it("directs intake-first clients to the intake flow", () => {
    const copy = buildClientDashboardHeadline({
      ...baseInput,
      restrictNavToIntake: true,
    });
    expect(copy.headline).toMatch(/intake/i);
  });

  it("avoids assessment detail copy when locked", () => {
    const copy = buildClientDashboardHeadline({
      ...baseInput,
      assessmentUnlocked: false,
    });
    expect(copy.subheadline).toMatch(/dedicated pages/i);
  });

  it("explains when intake was bypassed by the advisor", () => {
    const copy = buildClientDashboardHeadline({
      ...baseInput,
      intakeWaived: true,
      assessmentScopePending: true,
      assessmentUnlocked: false,
    });
    expect(copy.headline).toMatch(/skipped the intake interview/i);
    expect(copy.subheadline).toMatch(/bypassed/i);
  });

  it("uses advisor landing copy for the default welcome state", () => {
    const copy = buildClientDashboardHeadline({
      ...baseInput,
      assessmentUnlocked: true,
      assessmentInProgress: false,
      assessmentComplete: false,
      portalCopy: {
        landingHeadline: "Protect your family's legacy",
        landingSubheadline: "A tailored governance assessment for your household.",
        tagline: "Independent Wealth Group",
      },
    });
    expect(copy.headline).toBe("Protect your family's legacy");
    expect(copy.subheadline).toBe(
      "A tailored governance assessment for your household.",
    );
  });

  it("explains complete assessments waiting on preview unlock", () => {
    const copy = buildClientDashboardHeadline({
      ...baseInput,
      assessmentInProgress: false,
      assessmentComplete: true,
      canViewRiskPreview: false,
      canViewSummary: false,
    });
    expect(copy.headline).toMatch(/assessment is complete/i);
    expect(copy.subheadline).toMatch(/risk preview/i);
  });

  it("directs scored clients to open risk preview", () => {
    const copy = buildClientDashboardHeadline({
      ...baseInput,
      assessmentInProgress: false,
      assessmentComplete: true,
      canViewRiskPreview: true,
    });
    expect(copy.headline).toMatch(/preview is available/i);
    expect(copy.subheadline).toMatch(/open risk preview/i);
  });
});

describe("buildClientDashboardJourney", () => {
  it("locks assessment when intake gate is closed", () => {
    const steps = buildClientDashboardJourney({
      ...baseInput,
      assessmentUnlocked: false,
    });
    expect(steps.find((s) => s.id === "assessment")?.state).toBe("locked");
  });

  it("marks results current when preview is available", () => {
    const steps = buildClientDashboardJourney({
      ...baseInput,
      assessmentComplete: true,
      canViewRiskPreview: true,
    });
    expect(steps.find((s) => s.id === "results")?.state).toBe("current");
  });

  it("links journey steps to the same destinations as the portal cards", () => {
    const input = {
      ...baseInput,
      assessmentComplete: true,
      canViewRiskPreview: true,
    };
    const steps = buildClientDashboardJourney(input);
    const destinations = buildClientDashboardDestinations(input);

    for (const step of steps) {
      const destination = destinations.find((d) => d.id === step.id);
      expect(destination).toBeDefined();
      expect(step.href).toBe(destination!.href);
      expect(step.disabled).toBe(destination!.disabled);
    }
  });

  it("disables locked assessment journey navigation", () => {
    const steps = buildClientDashboardJourney({
      ...baseInput,
      assessmentUnlocked: false,
    });
    expect(steps.find((s) => s.id === "assessment")?.disabled).toBe(true);
  });
  it("omits action plan from journey when firm setting is disabled", () => {
    const steps = buildClientDashboardJourney({
      ...baseInput,
      assessmentComplete: true,
      canViewRiskPreview: true,
      actionPlanEnabled: false,
    });
    expect(steps.find((s) => s.id === "action-plan")).toBeUndefined();
    expect(steps).toHaveLength(3);
  });
});

describe("buildClientDashboardDestinations", () => {
  it("links to risk preview when summary is not published", () => {
    const destinations = buildClientDashboardDestinations({
      ...baseInput,
      assessmentComplete: true,
      canViewRiskPreview: true,
    });
    const results = destinations.find((d) => d.id === "results");
    expect(results?.href).toBe("/assessment/risk-preview");
    expect(results?.disabled).toBe(false);
  });

  it("hides action plan destination when firm setting is disabled", () => {
    const destinations = buildClientDashboardDestinations({
      ...baseInput,
      actionPlanEnabled: false,
    });
    expect(destinations.find((d) => d.id === "action-plan")).toBeUndefined();
  });

  it("always links action plan from the dashboard card when enabled", () => {
    const pending = buildClientDashboardDestinations({
      ...baseInput,
      canViewActionPlan: false,
    });
    const available = buildClientDashboardDestinations({
      ...baseInput,
      canViewActionPlan: true,
    });
    expect(pending.find((d) => d.id === "action-plan")?.disabled).toBeUndefined();
    expect(pending.find((d) => d.id === "action-plan")?.href).toBe(
      "/dashboard/action-plan"
    );
    expect(available.find((d) => d.id === "action-plan")?.disabled).toBeUndefined();
  });

  it("disables assessment when gate is closed", () => {
    const destinations = buildClientDashboardDestinations({
      ...baseInput,
      assessmentUnlocked: false,
    });
    expect(destinations.find((d) => d.id === "assessment")?.disabled).toBe(true);
  });

  it("routes locked intake answers to the read-only review page", () => {
    const destinations = buildClientDashboardDestinations({
      ...baseInput,
      intakeAnswersLocked: true,
    });
    const intake = destinations.find((d) => d.id === "intake");
    expect(intake?.href).toBe("/intake/review");
    expect(intake?.cta).toBe("View intake answers");
    expect(intake?.description).toMatch(/read-only/i);
  });

  it("routes waived intake with no interview to assessment when unlocked", () => {
    const input = {
      ...baseInput,
      intakeWaived: true,
      hasSubmittedInterview: false,
      intakeAnswersLocked: true,
    };
    const destinations = buildClientDashboardDestinations(input);
    const steps = buildClientDashboardJourney(input);
    const intakeDestination = destinations.find((d) => d.id === "intake");
    const intakeStep = steps.find((s) => s.id === "intake");

    expect(intakeDestination?.href).toBe("/assessment");
    expect(intakeDestination?.disabled).toBeFalsy();
    expect(intakeDestination?.cta).toBe("Open assessment");
    expect(intakeDestination?.description).toMatch(/bypassed/i);
    expect(intakeStep?.href).toBe("/assessment");
    expect(intakeStep?.disabled).toBe(false);
  });

  it("keeps waived intake journey clickable before assessment scope is set", () => {
    const input = {
      ...baseInput,
      intakeWaived: true,
      hasSubmittedInterview: false,
      assessmentUnlocked: false,
      intakeAnswersLocked: false,
    };
    const steps = buildClientDashboardJourney(input);
    const intakeStep = steps.find((s) => s.id === "intake");

    expect(intakeStep?.href).toBe("/intake");
    expect(intakeStep?.disabled).toBe(false);
  });

  it("marks waived intake as bypassed on the destination card", () => {
    const destinations = buildClientDashboardDestinations({
      ...baseInput,
      intakeWaived: true,
    });
    const intake = destinations.find((d) => d.id === "intake");
    expect(intake?.statusLabel).toBe("Bypassed");
    expect(intake?.description).toMatch(/bypassed/i);
    expect(intake?.href).toBe("/assessment");
    expect(intake?.disabled).toBeFalsy();
    expect(intake?.cta).toBe("Open assessment");
  });
});
