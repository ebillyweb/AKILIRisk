/**
 * §4.5 commit 3 (BRD §4.5) — backfill core tests.
 *
 * Coverage:
 *   • Inserts when assessment exists, has scores, and no Report rows.
 *   • Idempotent: skips when at least one Report already exists.
 *   • Skips when no PillarScore exists yet.
 *   • Skips when assessment id unknown (deleted between cursor + read).
 *   • Honors the COBRANDED-when-branding / AKILI-when-no-branding
 *     templateChoice rule.
 */

import { describe, it, expect, vi } from "vitest";
import {
  processOneAssessment,
  type BackfillDeps,
} from "./backfill-core";

const STUB_SNAPSHOT = {
  schemaVersion: 1 as const,
  pillar: "cyber-digital",
  reportData: {
    score: 7,
    riskLevel: "medium",
    breakdown: [],
    missingControls: [],
    assessmentDate: "March 4, 2026",
    completionPercentage: 100,
    categoryCount: 0,
    missingControlsCount: 0,
    pillarScores: [],
    pillarNarratives: [],
  },
  householdProfile: null,
};

function makeDeps(overrides: Partial<BackfillDeps> = {}): BackfillDeps {
  return {
    loadAssessment: vi.fn(async (id) => ({
      id,
      userId: "user-1",
      latestCalculatedAt: new Date("2026-03-04T12:00:00Z"),
    })),
    hasExistingReport: vi.fn(async () => false),
    buildSnapshot: vi.fn(async () => STUB_SNAPSHOT),
    buildBranding: vi.fn(async () => ({
      brandName: "Test Firm",
      advisorFirmName: "Test Firm",
      brandingEnabled: true,
      customDomainEnabled: false,
    })),
    insertSyntheticPublishedAndDraft: vi.fn(async () => ({
      publishedReportId: "rep-1",
    })),
    ...overrides,
  };
}

describe("processOneAssessment (backfill core)", () => {
  it("inserts a v=1 PUBLISHED + v=2 DRAFT for a scored assessment with no prior Reports", async () => {
    const deps = makeDeps();

    const result = await processOneAssessment("asmt-1", deps);

    expect(result.status).toBe("inserted");
    expect(deps.insertSyntheticPublishedAndDraft).toHaveBeenCalledOnce();
    const call = (
      deps.insertSyntheticPublishedAndDraft as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(call.assessmentId).toBe("asmt-1");
    expect(call.publishedAt).toEqual(new Date("2026-03-04T12:00:00Z"));
    expect(call.snapshot).toBe(STUB_SNAPSHOT);
    expect(call.templateChoice).toBe("COBRANDED");
  });

  it("is idempotent: skips when an existing Report row is present", async () => {
    const deps = makeDeps({
      hasExistingReport: vi.fn(async () => true),
    });

    const result = await processOneAssessment("asmt-1", deps);

    expect(result).toEqual({
      status: "skipped",
      reason: "already_has_reports",
    });
    expect(deps.insertSyntheticPublishedAndDraft).not.toHaveBeenCalled();
  });

  it("skips when the assessment has no PillarScore yet", async () => {
    const deps = makeDeps({
      loadAssessment: vi.fn(async (id) => ({
        id,
        userId: "user-1",
        latestCalculatedAt: null,
      })),
    });

    const result = await processOneAssessment("asmt-1", deps);

    expect(result).toEqual({ status: "skipped", reason: "no_pillar_scores" });
    expect(deps.insertSyntheticPublishedAndDraft).not.toHaveBeenCalled();
  });

  it("skips when the assessment id no longer exists", async () => {
    const deps = makeDeps({
      loadAssessment: vi.fn(async () => null),
    });

    const result = await processOneAssessment("asmt-vanished", deps);

    expect(result).toEqual({ status: "skipped", reason: "not_found" });
  });

  it("uses AKILI template when no advisor branding resolves", async () => {
    const deps = makeDeps({
      buildBranding: vi.fn(async () => null),
    });

    await processOneAssessment("asmt-1", deps);

    const call = (
      deps.insertSyntheticPublishedAndDraft as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(call.templateChoice).toBe("AKILI");
    expect(call.branding).toBeNull();
  });
});
