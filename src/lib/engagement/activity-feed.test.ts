/**
 * Tests for client activity feed query service.
 *
 * Coverage:
 *   - Query is scoped to clientId via OR conditions (recommendation-based + intelligence events)
 *   - Respects limit and offset defaults and overrides
 *   - CLIENT role excludes advisor-internal actions
 *   - ADVISOR role includes all actions
 *   - Maps Prisma result to ActivityFeedItem shape
 *   - Intelligence events (no assessmentRecommendation) get labeled correctly
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyActivities = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    solutionActivity: {
      findMany: (...a: unknown[]) => findManyActivities(...a),
    },
  },
}));

import { getClientActivityFeed } from "./activity-feed";

const mockActivity = (overrides: Record<string, unknown> = {}) => ({
  id: "act-1",
  action: "milestone_update",
  detail: { milestoneId: "m-1", status: "COMPLETED" },
  createdAt: new Date("2026-06-15T10:00:00Z"),
  actorId: "user-1",
  assessmentRecommendationId: "rec-1",
  assessmentRecommendation: {
    id: "rec-1",
    serviceRecommendation: { name: "Security Audit" },
  },
  ...overrides,
});

describe("getClientActivityFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyActivities.mockResolvedValue([]);
  });

  it("scopes query to clientId via OR conditions", async () => {
    await getClientActivityFeed({
      clientId: "client-abc",
      role: "ADVISOR",
    });

    expect(findManyActivities).toHaveBeenCalledTimes(1);
    const call = findManyActivities.mock.calls[0][0];
    // Phase 24 uses OR conditions for recommendation-based + intelligence events
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR).toHaveLength(2);
    // First condition: recommendation-based scoped to clientId
    expect(
      call.where.OR[0].assessmentRecommendation.assessment.userId,
    ).toBe("client-abc");
    // Second condition: intelligence events scoped to clientId
    expect(call.where.OR[1].assessment.userId).toBe("client-abc");
  });

  it("uses default limit=20 and offset=0", async () => {
    await getClientActivityFeed({
      clientId: "client-abc",
      role: "ADVISOR",
    });

    const call = findManyActivities.mock.calls[0][0];
    expect(call.take).toBe(20);
    expect(call.skip).toBe(0);
  });

  it("respects custom limit and offset", async () => {
    await getClientActivityFeed({
      clientId: "client-abc",
      limit: 5,
      offset: 10,
      role: "ADVISOR",
    });

    const call = findManyActivities.mock.calls[0][0];
    expect(call.take).toBe(5);
    expect(call.skip).toBe(10);
  });

  it("ADVISOR role does not filter action types", async () => {
    await getClientActivityFeed({
      clientId: "client-abc",
      role: "ADVISOR",
    });

    const call = findManyActivities.mock.calls[0][0];
    expect(call.where.action).toBeUndefined();
  });

  it("CLIENT role filters to client-visible actions only", async () => {
    await getClientActivityFeed({
      clientId: "client-abc",
      role: "CLIENT",
    });

    const call = findManyActivities.mock.calls[0][0];
    expect(call.where.action).toEqual({
      in: expect.arrayContaining([
        "milestone_update",
        "task_status_update",
        "action_plan_published",
      ]),
    });
    // Advisor-only actions like status_reviewed should not be in the list
    expect(call.where.action.in).not.toContain("status_reviewed");
    expect(call.where.action.in).not.toContain("status_declined");
  });

  it("maps recommendation-based results to ActivityFeedItem shape", async () => {
    findManyActivities.mockResolvedValue([mockActivity()]);

    const items = await getClientActivityFeed({
      clientId: "client-abc",
      role: "ADVISOR",
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: "act-1",
      action: "milestone_update",
      detail: { milestoneId: "m-1", status: "COMPLETED" },
      createdAt: new Date("2026-06-15T10:00:00Z"),
      actorId: "user-1",
      recommendationName: "Security Audit",
      recommendationId: "rec-1",
      eventType: "recommendation",
    });
  });

  it("uses 'Unknown' for missing recommendation name", async () => {
    findManyActivities.mockResolvedValue([
      mockActivity({
        assessmentRecommendationId: "rec-2",
        assessmentRecommendation: {
          id: "rec-2",
          serviceRecommendation: null,
        },
      }),
    ]);

    const items = await getClientActivityFeed({
      clientId: "client-abc",
      role: "ADVISOR",
    });

    expect(items[0]?.recommendationName).toBe("Unknown");
  });

  it("maps intelligence events with labeled action names", async () => {
    findManyActivities.mockResolvedValue([
      mockActivity({
        id: "act-intel",
        action: "assessment_completed",
        assessmentRecommendationId: null,
        assessmentRecommendation: null,
      }),
    ]);

    const items = await getClientActivityFeed({
      clientId: "client-abc",
      role: "ADVISOR",
    });

    expect(items[0]?.eventType).toBe("intelligence");
    expect(items[0]?.recommendationName).toBe("Assessment completed");
    expect(items[0]?.recommendationId).toBeNull();
  });

  it("orders by createdAt descending", async () => {
    await getClientActivityFeed({
      clientId: "client-abc",
      role: "ADVISOR",
    });

    const call = findManyActivities.mock.calls[0][0];
    expect(call.orderBy).toEqual({ createdAt: "desc" });
  });
});
