/**
 * Tests for intelligence event constants and logIntelligenceEvent helper.
 *
 * Coverage:
 *   - INTELLIGENCE_ACTIONS has all 12 event types
 *   - All action values are under 60 characters (varchar(60)-safe)
 *   - logIntelligenceEvent with assessmentId only
 *   - logIntelligenceEvent with assessmentRecommendationId only
 *   - logIntelligenceEvent with both
 *   - logIntelligenceEvent throws when neither provided
 *   - CLIENT_VISIBLE_INTELLIGENCE_ACTIONS is subset of INTELLIGENCE_ACTIONS
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const createActivity = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    solutionActivity: {
      create: (...a: unknown[]) => createActivity(...a),
    },
  },
}));

import {
  INTELLIGENCE_ACTIONS,
  CLIENT_VISIBLE_INTELLIGENCE_ACTIONS,
  logIntelligenceEvent,
} from "./intelligence-events";

describe("INTELLIGENCE_ACTIONS", () => {
  it("has exactly 12 event types", () => {
    const values = Object.values(INTELLIGENCE_ACTIONS);
    expect(values).toHaveLength(12);
  });

  it("has all expected event keys", () => {
    const keys = Object.keys(INTELLIGENCE_ACTIONS);
    expect(keys).toContain("ASSESSMENT_STARTED");
    expect(keys).toContain("ASSESSMENT_COMPLETED");
    expect(keys).toContain("SCORE_CALCULATED");
    expect(keys).toContain("REASSESSMENT_TRIGGERED");
    expect(keys).toContain("PILLAR_SCORE_DELTA");
    expect(keys).toContain("RISK_LEVEL_TRANSITION");
    expect(keys).toContain("CADENCE_DUE_APPROACHING");
    expect(keys).toContain("CADENCE_OVERDUE");
    expect(keys).toContain("CADENCE_CHANGED");
    expect(keys).toContain("CADENCE_SYSTEM_RECOMMENDED");
    expect(keys).toContain("RECOMMENDATION_IMPACT_MEASURED");
    expect(keys).toContain("COMPLETION_MILESTONE_REACHED");
  });

  it("all values are under 60 characters (varchar(60)-safe)", () => {
    for (const [key, value] of Object.entries(INTELLIGENCE_ACTIONS)) {
      expect(value.length, `${key} value "${value}" exceeds 60 chars`).toBeLessThanOrEqual(60);
    }
  });

  it("all values are unique", () => {
    const values = Object.values(INTELLIGENCE_ACTIONS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("CLIENT_VISIBLE_INTELLIGENCE_ACTIONS", () => {
  it("contains the expected 5 client-visible actions", () => {
    expect(CLIENT_VISIBLE_INTELLIGENCE_ACTIONS).toHaveLength(5);
    expect(CLIENT_VISIBLE_INTELLIGENCE_ACTIONS).toContain("assessment_completed");
    expect(CLIENT_VISIBLE_INTELLIGENCE_ACTIONS).toContain("score_calculated");
    expect(CLIENT_VISIBLE_INTELLIGENCE_ACTIONS).toContain("pillar_score_delta");
    expect(CLIENT_VISIBLE_INTELLIGENCE_ACTIONS).toContain("risk_level_transition");
    expect(CLIENT_VISIBLE_INTELLIGENCE_ACTIONS).toContain("completion_milestone_reached");
  });

  it("is a subset of INTELLIGENCE_ACTIONS values", () => {
    const allValues = Object.values(INTELLIGENCE_ACTIONS);
    for (const action of CLIENT_VISIBLE_INTELLIGENCE_ACTIONS) {
      expect(allValues).toContain(action);
    }
  });
});

describe("logIntelligenceEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createActivity.mockResolvedValue({ id: "activity-1" });
  });

  it("creates activity with assessmentId only (no recommendation)", async () => {
    await logIntelligenceEvent({
      action: INTELLIGENCE_ACTIONS.ASSESSMENT_COMPLETED,
      assessmentId: "assess-1",
      detail: { version: 2 },
    });

    expect(createActivity).toHaveBeenCalledWith({
      data: {
        action: "assessment_completed",
        assessmentId: "assess-1",
        detail: { version: 2 },
      },
    });
  });

  it("creates activity with assessmentRecommendationId only", async () => {
    await logIntelligenceEvent({
      action: INTELLIGENCE_ACTIONS.RECOMMENDATION_IMPACT_MEASURED,
      assessmentRecommendationId: "rec-1",
      actorId: "user-1",
    });

    expect(createActivity).toHaveBeenCalledWith({
      data: {
        action: "recommendation_impact_measured",
        assessmentRecommendationId: "rec-1",
        actorId: "user-1",
        detail: {},
      },
    });
  });

  it("creates activity with both assessmentId and assessmentRecommendationId", async () => {
    await logIntelligenceEvent({
      action: INTELLIGENCE_ACTIONS.COMPLETION_MILESTONE_REACHED,
      assessmentId: "assess-1",
      assessmentRecommendationId: "rec-1",
    });

    expect(createActivity).toHaveBeenCalledWith({
      data: {
        action: "completion_milestone_reached",
        assessmentId: "assess-1",
        assessmentRecommendationId: "rec-1",
        detail: {},
      },
    });
  });

  it("throws when neither assessmentId nor assessmentRecommendationId provided", async () => {
    await expect(
      logIntelligenceEvent({
        action: INTELLIGENCE_ACTIONS.SCORE_CALCULATED,
      }),
    ).rejects.toThrow(
      "logIntelligenceEvent requires at least one of assessmentId or assessmentRecommendationId",
    );

    expect(createActivity).not.toHaveBeenCalled();
  });

  it("uses transaction client when tx is provided", async () => {
    const txCreate = vi.fn().mockResolvedValue({ id: "tx-activity" });
    const tx = {
      solutionActivity: { create: txCreate },
    };

    await logIntelligenceEvent({
      tx: tx as never,
      action: INTELLIGENCE_ACTIONS.CADENCE_OVERDUE,
      assessmentId: "assess-2",
    });

    expect(txCreate).toHaveBeenCalledWith({
      data: {
        action: "cadence_overdue",
        assessmentId: "assess-2",
        detail: {},
      },
    });
    // Global prisma should NOT have been called
    expect(createActivity).not.toHaveBeenCalled();
  });
});
