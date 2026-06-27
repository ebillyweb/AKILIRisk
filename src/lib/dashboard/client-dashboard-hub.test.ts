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

  it("always links action plan from the dashboard card", () => {
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

  it("marks waived intake as bypassed on the destination card", () => {
    const destinations = buildClientDashboardDestinations({
      ...baseInput,
      intakeWaived: true,
    });
    const intake = destinations.find((d) => d.id === "intake");
    expect(intake?.statusLabel).toBe("Bypassed");
    expect(intake?.description).toMatch(/bypassed/i);
    expect(intake?.cta).toBe("Learn more");
  });
});
