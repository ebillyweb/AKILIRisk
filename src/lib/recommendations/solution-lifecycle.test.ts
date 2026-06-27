import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RecommendationStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// Mock prisma before importing the module under test
// ---------------------------------------------------------------------------

const mockFindUniqueOrThrow = vi.fn();
const mockUpdate = vi.fn();
const mockActivityCreate = vi.fn();
const mockMilestoneCount = vi.fn().mockResolvedValue(0);
const mockMilestoneCreateMany = vi.fn();
const mockFindUnique = vi.fn().mockResolvedValue(null);
const mockFindFirst = vi.fn().mockResolvedValue(null);
const mockEnterpriseFindUnique = vi.fn().mockResolvedValue(null);
const mockAdvisorFindUnique = vi.fn().mockResolvedValue(null);

// The transaction callback receives a tx client. We wire up the same mocks.
const txClient = {
  assessmentRecommendation: {
    findUniqueOrThrow: mockFindUniqueOrThrow,
    findUnique: mockFindUnique,
    update: mockUpdate,
  },
  solutionActivity: { create: mockActivityCreate },
  solutionMilestone: {
    count: mockMilestoneCount,
    createMany: mockMilestoneCreateMany,
  },
  clientAdvisorAssignment: { findFirst: mockFindFirst },
  enterpriseSolutionCustomization: { findUnique: mockEnterpriseFindUnique },
  advisorSolutionCustomization: { findUnique: mockAdvisorFindUnique },
};

// prisma.$transaction runs the callback with txClient
vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: (fn: (tx: typeof txClient) => Promise<void>) => fn(txClient),
  },
}));

// Mock server-only (no-op in tests)
vi.mock("server-only", () => ({}));

// Mock compose-solution
vi.mock("@/lib/recommendations/compose-solution", () => ({
  composeSolution: vi.fn(() => ({
    serviceId: "svc-1",
    name: "Test Solution",
    description: "desc",
    shortDescription: null,
    category: "Test",
    icon: null,
    expectedOutcome: null,
    tags: [],
    estimatedCost: null,
    timeframe: null,
    provider: null,
    externalUrl: null,
    prerequisites: [],
    playbook: [],
    notes: [],
    sourceLayer: { platform: true, enterprise: null, advisor: null },
  })),
}));

import {
  transitionRecommendationStatus,
  InvalidTransitionError,
  SOLUTION_ACTIONS,
} from "./solution-lifecycle";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setCurrentStatus(status: RecommendationStatus) {
  mockFindUniqueOrThrow.mockResolvedValueOnce({ status });
}

const defaultInput = {
  recommendationId: "rec-1",
  actorId: "actor-1",
};

// ---------------------------------------------------------------------------
// Tests: existing behavior (backward compat)
// ---------------------------------------------------------------------------

describe("InvalidTransitionError", () => {
  it("includes from and to in message", () => {
    const err = new InvalidTransitionError("COMPLETED" as RecommendationStatus, "PENDING" as RecommendationStatus);
    expect(err.message).toBe("Cannot transition from COMPLETED to PENDING");
    expect(err.name).toBe("InvalidTransitionError");
  });
});

describe("SOLUTION_ACTIONS", () => {
  it("has an action constant for each lifecycle status", () => {
    expect(SOLUTION_ACTIONS.STATUS_PENDING).toBe("status_pending");
    expect(SOLUTION_ACTIONS.STATUS_REVIEWED).toBe("status_reviewed");
    expect(SOLUTION_ACTIONS.STATUS_ACCEPTED).toBe("status_accepted");
    expect(SOLUTION_ACTIONS.STATUS_DECLINED).toBe("status_declined");
    expect(SOLUTION_ACTIONS.STATUS_COMPLETED).toBe("status_completed");
    expect(SOLUTION_ACTIONS.MILESTONE_UPDATE).toBe("milestone_update");
  });

  it("includes Phase 22 action constants", () => {
    expect(SOLUTION_ACTIONS.STATUS_GENERATED).toBe("status_generated");
    expect(SOLUTION_ACTIONS.STATUS_INCLUDED).toBe("status_included");
    expect(SOLUTION_ACTIONS.STATUS_DEFERRED).toBe("status_deferred");
    expect(SOLUTION_ACTIONS.STATUS_IN_PROGRESS).toBe("status_in_progress");
  });

  it("uses lowercase status names consistently", () => {
    const statusActions = Object.entries(SOLUTION_ACTIONS)
      .filter(([k]) => k.startsWith("STATUS_"))
      .map(([, v]) => v);

    for (const action of statusActions) {
      expect(action).toMatch(/^status_[a-z_]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: state machine transitions
// ---------------------------------------------------------------------------

describe("transitionRecommendationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMilestoneCount.mockResolvedValue(0);
    mockFindUnique.mockResolvedValue(null);
    mockFindFirst.mockResolvedValue(null);
  });

  // ------- Phase 22 new transitions -------

  it("GENERATED -> REVIEWED transition succeeds", async () => {
    setCurrentStatus("GENERATED");
    await transitionRecommendationStatus({
      ...defaultInput,
      newStatus: "REVIEWED",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REVIEWED" }),
      })
    );
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: SOLUTION_ACTIONS.STATUS_REVIEWED,
        }),
      })
    );
  });

  it("REVIEWED -> INCLUDED transition succeeds and composes solution", async () => {
    setCurrentStatus("REVIEWED");
    await transitionRecommendationStatus({
      ...defaultInput,
      newStatus: "INCLUDED",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "INCLUDED",
          acceptedAt: expect.any(Date),
        }),
      })
    );
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: SOLUTION_ACTIONS.STATUS_INCLUDED,
        }),
      })
    );
  });

  it("INCLUDED -> IN_PROGRESS transition succeeds and sets startedAt", async () => {
    setCurrentStatus("INCLUDED");
    await transitionRecommendationStatus({
      ...defaultInput,
      newStatus: "IN_PROGRESS",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "IN_PROGRESS",
          startedAt: expect.any(Date),
        }),
      })
    );
  });

  it("REVIEWED -> DEFERRED transition succeeds with reason and optional fields", async () => {
    setCurrentStatus("REVIEWED");
    const revisitDate = new Date("2026-12-01");
    await transitionRecommendationStatus({
      ...defaultInput,
      newStatus: "DEFERRED",
      reason: "Pending estate valuation",
      deferredRevisitDate: revisitDate,
      deferredTriggerEvent: "After business valuation is complete",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DEFERRED",
          deferredReason: "Pending estate valuation",
          deferredRevisitDate: revisitDate,
          deferredTriggerEvent: "After business valuation is complete",
        }),
      })
    );
    expect(mockActivityCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: SOLUTION_ACTIONS.STATUS_DEFERRED,
          detail: expect.objectContaining({
            from: "REVIEWED",
            to: "DEFERRED",
            reason: "Pending estate valuation",
          }),
        }),
      })
    );
  });

  it("DEFERRED -> REVIEWED transition succeeds (re-review)", async () => {
    setCurrentStatus("DEFERRED");
    await transitionRecommendationStatus({
      ...defaultInput,
      newStatus: "REVIEWED",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REVIEWED" }),
      })
    );
  });

  it("GENERATED -> COMPLETED transition fails (InvalidTransitionError)", async () => {
    setCurrentStatus("GENERATED");
    await expect(
      transitionRecommendationStatus({
        ...defaultInput,
        newStatus: "COMPLETED",
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  // ------- Backward compatibility -------

  it("backward compat: REVIEWED -> ACCEPTED still works", async () => {
    setCurrentStatus("REVIEWED");
    await transitionRecommendationStatus({
      ...defaultInput,
      newStatus: "ACCEPTED",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ACCEPTED",
          acceptedAt: expect.any(Date),
        }),
      })
    );
  });

  it("backward compat: PENDING -> REVIEWED still works", async () => {
    setCurrentStatus("PENDING");
    await transitionRecommendationStatus({
      ...defaultInput,
      newStatus: "REVIEWED",
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "REVIEWED" }),
      })
    );
  });

  // ------- Additional invalid transitions -------

  it("IN_PROGRESS -> DEFERRED is not allowed", async () => {
    setCurrentStatus("IN_PROGRESS");
    await expect(
      transitionRecommendationStatus({
        ...defaultInput,
        newStatus: "DEFERRED",
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("COMPLETED -> REVIEWED is not allowed (terminal state)", async () => {
    setCurrentStatus("COMPLETED");
    await expect(
      transitionRecommendationStatus({
        ...defaultInput,
        newStatus: "REVIEWED",
      })
    ).rejects.toThrow(InvalidTransitionError);
  });
});
