/**
 * BRD Epic 5.4 / US-33c — Portfolio Recommendations query tests.
 *
 * Coverage:
 *   • Empty assignment list short-circuits to zero counts and no groups.
 *   • Only ACTIVE-assigned clients with COMPLETED assessments are
 *     considered.
 *   • Recommendations are projected into the UI shape with the merged
 *     service-recommendation fields and the formatted trigger summary.
 *   • The default `status=pending` filter hides non-Pending rows; the
 *     `status=all` filter shows everything; the `category` filter is
 *     case-insensitive.
 *   • The `actionNeededOnly` filter implements the BRD definition: a
 *     Pending row whose assessment is in PREVIEW, OR a Pending row
 *     whose assessment has a Draft report but no Published report.
 *   • Groups are sorted by pending count (desc) then client name.
 *   • Summary counts (assignedClients, clientsWithRecommendations,
 *     totalRecommendations, pendingCount, actionNeededCount) are
 *     computed across the post-filter groups.
 *   • A group with zero items after filtering is dropped.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const findAssignments = vi.fn();
const findAssessments = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findMany: (...a: unknown[]) => findAssignments(...a),
    },
    assessment: {
      findMany: (...a: unknown[]) => findAssessments(...a),
    },
  },
}));

const displayName = vi.fn(async (clientId: string) => `Name(${clientId})`);
vi.mock("@/lib/signals/emit", () => ({
  resolveClientDisplayName: (clientId: string) => displayName(clientId),
}));

vi.mock("@/lib/recommendations/format-trigger", () => ({
  formatTriggerSummary: (_t: unknown) => "trigger-summary",
}));

import { getPortfolioRecommendations } from "./queries";

type Rec = {
  id: string;
  serviceRecommendationId: string;
  priority: number;
  status: "PENDING" | "REVIEWED" | "ACCEPTED" | "DECLINED" | "COMPLETED";
  triggerReason: unknown;
  advisorNotes: string | null;
  serviceRecommendation: {
    id: string;
    name: string;
    category: string;
    description: string;
    tier: "BASELINE" | "ENHANCED" | null;
  };
};

type Assessment = {
  id: string;
  userId: string;
  status: "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";
  completedAt: Date | null;
  deliverablePhase: "PREVIEW" | "PROFILE" | "PORTFOLIO";
  recommendations: Rec[];
  reports: Array<{ status: "DRAFT" | "PUBLISHED" | "SUPERSEDED" }>;
};

beforeEach(() => {
  findAssignments.mockReset();
  findAssessments.mockReset();
  displayName.mockClear();
});

function rec(
  partial: Partial<Rec> & Pick<Rec, "id" | "status" | "priority">
): Rec {
  return {
    serviceRecommendationId: `svc-${partial.id}`,
    triggerReason: { type: "stub" },
    advisorNotes: null,
    serviceRecommendation: {
      id: `svc-${partial.id}`,
      name: `Service ${partial.id}`,
      category: "Cyber",
      description: "Stub description",
      tier: null,
    },
    ...partial,
  };
}

describe("getPortfolioRecommendations — empty state", () => {
  it("returns zero counts and no groups when no clients are assigned", async () => {
    findAssignments.mockResolvedValue([]);
    findAssessments.mockResolvedValue([]); // not exercised
    const result = await getPortfolioRecommendations("adv-1");
    expect(result.groups).toEqual([]);
    expect(result.summary).toEqual({
      assignedClients: 0,
      clientsWithRecommendations: 0,
      totalRecommendations: 0,
      pendingCount: 0,
      actionNeededCount: 0,
    });
    expect(findAssessments).not.toHaveBeenCalled();
  });
});

describe("getPortfolioRecommendations — projection and sorting", () => {
  it("projects each recommendation into the UI shape with formatted trigger summary", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date("2026-05-20T10:00:00Z"),
        deliverablePhase: "PROFILE",
        recommendations: [
          rec({
            id: "rec-1",
            serviceRecommendationId: "svc-1",
            priority: 1,
            status: "PENDING",
            advisorNotes: "Discuss next quarter.",
            serviceRecommendation: {
              id: "svc-1",
              name: "MFA Rollout",
              category: "Cyber",
              description: "Roll out MFA across all family accounts.",
              tier: "ENHANCED",
            },
          }),
        ],
        reports: [],
      } satisfies Assessment,
    ]);

    const result = await getPortfolioRecommendations("adv-1");
    expect(result.groups).toHaveLength(1);
    const group = result.groups[0];
    expect(group.clientId).toBe("client-1");
    expect(group.clientName).toBe("Name(client-1)");
    expect(group.assessmentId).toBe("asmt-1");
    expect(group.editReportHref).toBe("/advisor/pipeline/client-1/report/edit");
    expect(group.intelligenceHref).toBe("/advisor/intelligence/client-1");
    expect(group.recommendations).toEqual([
      {
        id: "rec-1",
        serviceRecommendationId: "svc-1",
        serviceName: "MFA Rollout",
        category: "Cyber",
        description: "Roll out MFA across all family accounts.",
        tier: "ENHANCED",
        priority: 1,
        status: "PENDING",
        triggerSummary: "trigger-summary",
        advisorNotes: "Discuss next quarter.",
      },
    ]);
  });

  it("keeps only the most recent assessment per client", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      // Already ordered by completedAt desc when queried (orderBy is part
      // of the Prisma query). The action just takes the first per userId.
      {
        id: "asmt-newer",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date("2026-05-20T10:00:00Z"),
        deliverablePhase: "PROFILE",
        recommendations: [rec({ id: "rec-a", priority: 1, status: "PENDING" })],
        reports: [],
      },
      {
        id: "asmt-older",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date("2026-04-01T10:00:00Z"),
        deliverablePhase: "PROFILE",
        recommendations: [rec({ id: "rec-old", priority: 1, status: "PENDING" })],
        reports: [],
      },
    ]);

    const result = await getPortfolioRecommendations("adv-1");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].assessmentId).toBe("asmt-newer");
    expect(result.groups[0].recommendations.map((r) => r.id)).toEqual(["rec-a"]);
  });

  it("sorts groups by pending count descending, then client name", async () => {
    findAssignments.mockResolvedValue([
      { clientId: "client-a" },
      { clientId: "client-b" },
      { clientId: "client-c" },
    ]);
    displayName.mockImplementation(async (id) => {
      if (id === "client-a") return "Charlie";
      if (id === "client-b") return "Alex";
      return "Bobby";
    });
    findAssessments.mockResolvedValue([
      {
        id: "asmt-a",
        userId: "client-a",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PROFILE",
        recommendations: [
          rec({ id: "ra1", priority: 1, status: "PENDING" }),
          rec({ id: "ra2", priority: 1, status: "PENDING" }),
        ],
        reports: [],
      },
      {
        id: "asmt-b",
        userId: "client-b",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PROFILE",
        recommendations: [rec({ id: "rb1", priority: 1, status: "PENDING" })],
        reports: [],
      },
      {
        id: "asmt-c",
        userId: "client-c",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PROFILE",
        recommendations: [rec({ id: "rc1", priority: 1, status: "PENDING" })],
        reports: [],
      },
    ]);

    const result = await getPortfolioRecommendations("adv-1");
    // client-a has 2 pending (most); client-b ("Alex") and client-c ("Bobby")
    // tie on 1 pending each → sorted by client name ascending.
    expect(result.groups.map((g) => g.clientName)).toEqual([
      "Charlie",
      "Alex",
      "Bobby",
    ]);
  });

  it("drops a client group whose items disappear after filtering", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PROFILE",
        recommendations: [rec({ id: "rec-1", priority: 1, status: "REVIEWED" })],
        reports: [],
      },
    ]);
    // Default status=pending filter → REVIEWED gets filtered out → no group.
    const result = await getPortfolioRecommendations("adv-1", { status: "pending" });
    expect(result.groups).toHaveLength(0);
    expect(result.summary.clientsWithRecommendations).toBe(0);
  });
});

describe("getPortfolioRecommendations — filters", () => {
  function seedSingleClientMix() {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PROFILE",
        recommendations: [
          rec({ id: "rec-pending", priority: 1, status: "PENDING" }),
          rec({
            id: "rec-reviewed",
            priority: 2,
            status: "REVIEWED",
            serviceRecommendation: {
              id: "svc-2",
              name: "Identity Monitoring",
              category: "identity",
              description: "Set up identity monitoring.",
              tier: "BASELINE",
            },
          }),
        ],
        reports: [],
      },
    ]);
  }

  it("status=pending shows only PENDING items", async () => {
    seedSingleClientMix();
    const result = await getPortfolioRecommendations("adv-1", { status: "pending" });
    expect(result.groups[0].recommendations.map((r) => r.id)).toEqual([
      "rec-pending",
    ]);
  });

  it("status=all shows every status", async () => {
    seedSingleClientMix();
    const result = await getPortfolioRecommendations("adv-1", { status: "all" });
    expect(result.groups[0].recommendations.map((r) => r.id).sort()).toEqual([
      "rec-pending",
      "rec-reviewed",
    ]);
  });

  it("applies the category filter case-insensitively", async () => {
    seedSingleClientMix();
    const result = await getPortfolioRecommendations("adv-1", {
      status: "all",
      category: "IDENTITY",
    });
    expect(result.groups[0].recommendations.map((r) => r.id)).toEqual([
      "rec-reviewed",
    ]);
  });
});

describe("getPortfolioRecommendations — actionNeededOnly", () => {
  it("keeps a Pending recommendation whose assessment is in PREVIEW", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PREVIEW",
        recommendations: [rec({ id: "rec-1", priority: 1, status: "PENDING" })],
        reports: [],
      },
    ]);
    const result = await getPortfolioRecommendations("adv-1", {
      actionNeededOnly: true,
    });
    expect(result.summary.actionNeededCount).toBe(1);
    expect(result.groups[0].recommendations.map((r) => r.id)).toEqual(["rec-1"]);
  });

  it("keeps a Pending recommendation when a Draft exists with no Published report", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PROFILE",
        recommendations: [rec({ id: "rec-1", priority: 1, status: "PENDING" })],
        reports: [{ status: "DRAFT" }],
      },
    ]);
    const result = await getPortfolioRecommendations("adv-1", {
      actionNeededOnly: true,
    });
    expect(result.groups[0].recommendations.map((r) => r.id)).toEqual(["rec-1"]);
  });

  it("drops a Pending recommendation once a Published report exists", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PROFILE",
        recommendations: [rec({ id: "rec-1", priority: 1, status: "PENDING" })],
        reports: [{ status: "DRAFT" }, { status: "PUBLISHED" }],
      },
    ]);
    const result = await getPortfolioRecommendations("adv-1", {
      actionNeededOnly: true,
    });
    expect(result.groups).toHaveLength(0);
  });

  it("drops a non-Pending recommendation regardless of phase or report state", async () => {
    findAssignments.mockResolvedValue([{ clientId: "client-1" }]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PREVIEW",
        recommendations: [rec({ id: "rec-1", priority: 1, status: "REVIEWED" })],
        reports: [],
      },
    ]);
    const result = await getPortfolioRecommendations("adv-1", {
      actionNeededOnly: true,
    });
    expect(result.groups).toHaveLength(0);
  });
});

describe("getPortfolioRecommendations — summary math", () => {
  it("counts assigned clients, groups, total, pending, and action-needed", async () => {
    findAssignments.mockResolvedValue([
      { clientId: "client-1" },
      { clientId: "client-2" },
      { clientId: "client-empty" },
    ]);
    findAssessments.mockResolvedValue([
      {
        id: "asmt-1",
        userId: "client-1",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PREVIEW",
        recommendations: [
          rec({ id: "rec-1a", priority: 1, status: "PENDING" }),
          rec({ id: "rec-1b", priority: 2, status: "REVIEWED" }),
        ],
        reports: [],
      },
      {
        id: "asmt-2",
        userId: "client-2",
        status: "COMPLETED",
        completedAt: new Date(),
        deliverablePhase: "PROFILE",
        recommendations: [rec({ id: "rec-2a", priority: 1, status: "PENDING" })],
        reports: [{ status: "PUBLISHED" }],
      },
    ]);
    // status=all so we include both Pending and Reviewed.
    const result = await getPortfolioRecommendations("adv-1", { status: "all" });
    expect(result.summary.assignedClients).toBe(3);
    expect(result.summary.clientsWithRecommendations).toBe(2);
    expect(result.summary.totalRecommendations).toBe(3);
    expect(result.summary.pendingCount).toBe(2);
    // client-1: Pending+PREVIEW → action needed. client-2: Pending+PROFILE
    // with a Published report → not action needed.
    expect(result.summary.actionNeededCount).toBe(1);
  });
});
