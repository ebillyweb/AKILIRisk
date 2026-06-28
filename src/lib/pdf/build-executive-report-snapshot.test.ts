/**
 * Phase 25: Unit tests for ExecutiveReportSnapshot derivation functions and builder.
 *
 * Pure functions (deriveExecutiveReadiness, deriveImpactLevel) are tested
 * directly without mocking.
 *
 * buildExecutiveReportSnapshot is tested with mocked Prisma, mocked guidance
 * package, mocked engagement metrics, and mocked computePillarDeltas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deriveExecutiveReadiness,
  deriveImpactLevel,
  type PillarReadiness,
} from "./executive-report-types";

// ---------------------------------------------------------------------------
// Mock server-only (bypasses the server-only guard in test environment)
// ---------------------------------------------------------------------------
vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    executiveReport: {
      findFirst: vi.fn(),
    },
    solutionActivity: {
      findMany: vi.fn(),
    },
    reviewCadence: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock guidance package and engagement metrics
// ---------------------------------------------------------------------------
vi.mock("@/lib/recommendations/guidance-package", () => ({
  getGuidancePackageForClient: vi.fn(),
}));

vi.mock("@/lib/engagement/engagement-metrics", () => ({
  getEngagementClients: vi.fn(),
}));

vi.mock("@/lib/analytics/score-delta", () => ({
  computePillarDeltas: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks are set up
// ---------------------------------------------------------------------------
import { buildExecutiveReportSnapshot } from "./build-executive-report-snapshot";
import { prisma } from "@/lib/db";
import { getGuidancePackageForClient } from "@/lib/recommendations/guidance-package";
import { getEngagementClients } from "@/lib/engagement/engagement-metrics";
import { computePillarDeltas } from "@/lib/analytics/score-delta";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makePillarReadiness(
  overrides: Partial<PillarReadiness> & { pillar: string },
): PillarReadiness {
  return {
    pillarLabel: overrides.pillar,
    score: 75,
    riskLevel: "MEDIUM",
    impactLevel: "Medium",
    ...overrides,
  };
}

const EMPTY_GUIDANCE_PACKAGE = {
  clientId: "client-1",
  clientName: "Test Client",
  items: [],
  summary: {
    totalItems: 0,
    includedCount: 0,
    deferredCount: 0,
    completedCount: 0,
    inProgressCount: 0,
    hiddenCount: 0,
  },
};

function makeAssessment(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    userId: "client-1",
    status: "COMPLETED",
    startedAt: new Date("2026-01-01"),
    completedAt: new Date("2026-01-15"),
    previousAssessmentId: null,
    scores: [
      { pillar: "governance", score: 80, riskLevel: "LOW" },
      { pillar: "cyber", score: 45, riskLevel: "HIGH" },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: deriveExecutiveReadiness
// ---------------------------------------------------------------------------

describe("deriveExecutiveReadiness", () => {
  it('returns "Developing" when any pillar has CRITICAL risk level', () => {
    const pillars: PillarReadiness[] = [
      makePillarReadiness({ pillar: "governance", riskLevel: "CRITICAL", score: 20 }),
      makePillarReadiness({ pillar: "cyber", riskLevel: "LOW", score: 90 }),
    ];
    const result = deriveExecutiveReadiness(pillars);
    expect(result.tier).toBe("Developing");
  });

  it('returns "Developing" when 2 or more pillars have HIGH risk level', () => {
    const pillars: PillarReadiness[] = [
      makePillarReadiness({ pillar: "governance", riskLevel: "HIGH", score: 50 }),
      makePillarReadiness({ pillar: "cyber", riskLevel: "HIGH", score: 55 }),
      makePillarReadiness({ pillar: "estate", riskLevel: "MEDIUM", score: 65 }),
    ];
    const result = deriveExecutiveReadiness(pillars);
    expect(result.tier).toBe("Developing");
  });

  it('returns "Advanced" when 60%+ of pillars are LOW risk', () => {
    const pillars: PillarReadiness[] = [
      makePillarReadiness({ pillar: "governance", riskLevel: "LOW", score: 92 }),
      makePillarReadiness({ pillar: "cyber", riskLevel: "LOW", score: 88 }),
      makePillarReadiness({ pillar: "estate", riskLevel: "LOW", score: 85 }),
      makePillarReadiness({ pillar: "identity", riskLevel: "MEDIUM", score: 70 }),
      makePillarReadiness({ pillar: "ownership", riskLevel: "MEDIUM", score: 68 }),
    ];
    const result = deriveExecutiveReadiness(pillars);
    expect(result.tier).toBe("Advanced");
  });

  it('returns "Mature" when no critical/2+high and fewer than 60% LOW', () => {
    const pillars: PillarReadiness[] = [
      makePillarReadiness({ pillar: "governance", riskLevel: "LOW", score: 90 }),
      makePillarReadiness({ pillar: "cyber", riskLevel: "MEDIUM", score: 65 }),
      makePillarReadiness({ pillar: "estate", riskLevel: "MEDIUM", score: 62 }),
      makePillarReadiness({ pillar: "identity", riskLevel: "HIGH", score: 48 }),
    ];
    const result = deriveExecutiveReadiness(pillars);
    expect(result.tier).toBe("Mature");
  });

  it("sorts highestRiskDomains by score ascending (worst first)", () => {
    const pillars: PillarReadiness[] = [
      makePillarReadiness({ pillar: "governance", pillarLabel: "Governance", riskLevel: "HIGH", score: 55 }),
      makePillarReadiness({ pillar: "cyber", pillarLabel: "Cybersecurity", riskLevel: "CRITICAL", score: 20 }),
      makePillarReadiness({ pillar: "estate", pillarLabel: "Estate Planning", riskLevel: "HIGH", score: 50 }),
    ];
    const result = deriveExecutiveReadiness(pillars);
    expect(result.highestRiskDomains[0]).toBe("Cybersecurity"); // lowest score first
    expect(result.highestRiskDomains[1]).toBe("Estate Planning");
    expect(result.highestRiskDomains[2]).toBe("Governance");
  });

  it("sorts strongestDomains by score descending (best first)", () => {
    const pillars: PillarReadiness[] = [
      makePillarReadiness({ pillar: "governance", pillarLabel: "Governance", riskLevel: "LOW", score: 85 }),
      makePillarReadiness({ pillar: "cyber", pillarLabel: "Cybersecurity", riskLevel: "LOW", score: 92 }),
      makePillarReadiness({ pillar: "estate", pillarLabel: "Estate Planning", riskLevel: "MEDIUM", score: 70 }),
    ];
    const result = deriveExecutiveReadiness(pillars);
    expect(result.strongestDomains[0]).toBe("Cybersecurity"); // highest score first
    expect(result.strongestDomains[1]).toBe("Governance");
    expect(result.strongestDomains).not.toContain("Estate Planning"); // not LOW
  });

  it("derives strategicPriorities from highestRiskDomains", () => {
    const pillars: PillarReadiness[] = [
      makePillarReadiness({ pillar: "cyber", pillarLabel: "Cybersecurity", riskLevel: "CRITICAL", score: 25 }),
    ];
    const result = deriveExecutiveReadiness(pillars);
    expect(result.strategicPriorities).toEqual(["Address Cybersecurity risk exposure"]);
  });

  it("returns Developing with empty arrays when no pillars provided", () => {
    const result = deriveExecutiveReadiness([]);
    expect(result.tier).toBe("Developing");
    expect(result.highestRiskDomains).toEqual([]);
    expect(result.strongestDomains).toEqual([]);
    expect(result.strategicPriorities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tests: deriveImpactLevel
// ---------------------------------------------------------------------------

describe("deriveImpactLevel", () => {
  it("returns Critical when composite >= 7", () => {
    // urgencyScore=10, pillarWeight=16 -> composite = 10 * (16/16) = 10
    expect(deriveImpactLevel(10, 16)).toBe("Critical");
    // urgencyScore=7, pillarWeight=16 -> composite = 7
    expect(deriveImpactLevel(7, 16)).toBe("Critical");
  });

  it("returns High when composite >= 5 and < 7", () => {
    // urgencyScore=5, pillarWeight=16 -> composite = 5
    expect(deriveImpactLevel(5, 16)).toBe("High");
    // urgencyScore=6, pillarWeight=16 -> composite = 6
    expect(deriveImpactLevel(6, 16)).toBe("High");
  });

  it("returns Medium when composite >= 3 and < 5", () => {
    // urgencyScore=3, pillarWeight=16 -> composite = 3
    expect(deriveImpactLevel(3, 16)).toBe("Medium");
    // urgencyScore=4, pillarWeight=16 -> composite = 4
    expect(deriveImpactLevel(4, 16)).toBe("Medium");
  });

  it("returns Low when composite < 3", () => {
    // urgencyScore=2, pillarWeight=16 -> composite = 2
    expect(deriveImpactLevel(2, 16)).toBe("Low");
    // urgencyScore=1, pillarWeight=16 -> composite = 1
    expect(deriveImpactLevel(1, 16)).toBe("Low");
  });

  it("applies pillar weight scaling correctly", () => {
    // urgencyScore=8, pillarWeight=8 -> composite = 8 * (8/16) = 4 -> Medium
    expect(deriveImpactLevel(8, 8)).toBe("Medium");
    // urgencyScore=10, pillarWeight=8 -> composite = 10 * (8/16) = 5 -> High
    expect(deriveImpactLevel(10, 8)).toBe("High");
  });
});

// ---------------------------------------------------------------------------
// Tests: buildExecutiveReportSnapshot
// ---------------------------------------------------------------------------

describe("buildExecutiveReportSnapshot", () => {
  const CLIENT_ID = "client-1";
  const ADVISOR_PROFILE_ID = "advisor-profile-1";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    vi.mocked(prisma.executiveReport.findFirst).mockResolvedValue(null);
    vi.mocked(getGuidancePackageForClient).mockResolvedValue(EMPTY_GUIDANCE_PACKAGE);
    vi.mocked(getEngagementClients).mockResolvedValue([]);
    vi.mocked(prisma.solutionActivity.findMany).mockResolvedValue([]);
    vi.mocked(prisma.reviewCadence.findFirst).mockResolvedValue(null);
  });

  it("returns a valid ExecutiveReportSnapshot with schemaVersion 1", async () => {
    const assessment = makeAssessment("assessment-1");
    vi.mocked(prisma.assessment.findMany).mockResolvedValue([assessment] as never);
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      previousAssessmentId: null,
      user: { name: "John Doe" },
    } as never);

    const snapshot = await buildExecutiveReportSnapshot(CLIENT_ID, ADVISOR_PROFILE_ID);

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.clientName).toBe("John Doe");
    expect(snapshot.currentAssessmentId).toBe("assessment-1");
    expect(snapshot.previousAssessmentId).toBeNull();
    expect(snapshot.assessmentIds).toEqual(["assessment-1"]);
    expect(typeof snapshot.generatedAt).toBe("string");
    expect(snapshot.advisorNotes).toBeNull();
    expect(snapshot.meetingAgenda).toBeNull();
    expect(snapshot.discussionPrompts).toEqual([]);
  });

  it("returns null scoreDelta when no previous assessment exists", async () => {
    const assessment = makeAssessment("assessment-1");
    vi.mocked(prisma.assessment.findMany).mockResolvedValue([assessment] as never);
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      previousAssessmentId: null,
      user: { name: "Jane Smith" },
    } as never);

    const snapshot = await buildExecutiveReportSnapshot(CLIENT_ID, ADVISOR_PROFILE_ID);

    expect(snapshot.scoreDelta).toBeNull();
  });

  it("returns populated scoreDelta when previous assessment exists", async () => {
    const prevAssessment = makeAssessment("assessment-0", {
      id: "assessment-0",
      completedAt: new Date("2025-06-01"),
      scores: [
        { pillar: "governance", score: 70, riskLevel: "MEDIUM" },
        { pillar: "cyber", score: 35, riskLevel: "HIGH" },
      ],
    });
    const currAssessment = makeAssessment("assessment-1", {
      completedAt: new Date("2026-01-15"),
    });

    vi.mocked(prisma.assessment.findMany).mockResolvedValue([
      prevAssessment,
      currAssessment,
    ] as never);
    vi.mocked(prisma.assessment.findUnique).mockImplementation(
      ({ where }: { where: { id: string } }) => {
        if (where.id === "assessment-1") {
          return Promise.resolve({
            previousAssessmentId: "assessment-0",
            user: { name: "Test User" },
          }) as never;
        }
        if (where.id === "assessment-0") {
          return Promise.resolve({
            scores: prevAssessment.scores,
          }) as never;
        }
        return Promise.resolve(null) as never;
      },
    );

    vi.mocked(computePillarDeltas).mockReturnValue([
      {
        pillar: "governance",
        previousScore: 70,
        currentScore: 80,
        delta: 10,
        direction: "improved",
        previousRiskLevel: "MEDIUM",
        currentRiskLevel: "LOW",
        attribution: ["Governance Charter adopted"],
      },
      {
        pillar: "cyber",
        previousScore: 35,
        currentScore: 45,
        delta: 10,
        direction: "improved",
        previousRiskLevel: "HIGH",
        currentRiskLevel: "HIGH",
        attribution: ["No new planning activity"],
      },
    ]);

    const snapshot = await buildExecutiveReportSnapshot(CLIENT_ID, ADVISOR_PROFILE_ID);

    expect(snapshot.scoreDelta).not.toBeNull();
    expect(snapshot.scoreDelta?.overallDirection).toBe("improved");
    expect(snapshot.scoreDelta?.deltas).toHaveLength(2);
    expect(snapshot.scoreDelta?.keyDrivers).toContain("Governance Charter adopted");
  });

  it("uses earliest assessment.startedAt for first-ever report (D-22)", async () => {
    const assessment = makeAssessment("assessment-1", {
      startedAt: new Date("2025-06-15"),
    });
    vi.mocked(prisma.assessment.findMany).mockResolvedValue([assessment] as never);
    vi.mocked(prisma.executiveReport.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      previousAssessmentId: null,
      user: { name: "First Timer" },
    } as never);

    const snapshot = await buildExecutiveReportSnapshot(CLIENT_ID, ADVISOR_PROFILE_ID);

    // Period start should be the assessment's startedAt
    expect(snapshot.reportingPeriod.start).toBe(
      new Date("2025-06-15").toISOString(),
    );
  });

  it("returns null engagementSummary when no engagement data for client", async () => {
    const assessment = makeAssessment("assessment-1");
    vi.mocked(prisma.assessment.findMany).mockResolvedValue([assessment] as never);
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      previousAssessmentId: null,
      user: { name: "No Engagement" },
    } as never);
    // getEngagementClients returns rows but none for this client
    vi.mocked(getEngagementClients).mockResolvedValue([
      {
        clientId: "other-client",
        clientName: "Other",
        clientEmail: "",
        completionPct: 50,
        completedCount: 3,
        totalCount: 6,
        lastActivityAt: null,
        blockedCount: 0,
        isStalled: false,
      },
    ]);

    const snapshot = await buildExecutiveReportSnapshot(CLIENT_ID, ADVISOR_PROFILE_ID);

    expect(snapshot.engagementSummary).toBeNull();
  });

  it("populates engagementSummary when engagement data exists for client", async () => {
    const assessment = makeAssessment("assessment-1");
    vi.mocked(prisma.assessment.findMany).mockResolvedValue([assessment] as never);
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      previousAssessmentId: null,
      user: { name: "Engaged Client" },
    } as never);
    vi.mocked(getEngagementClients).mockResolvedValue([
      {
        clientId: CLIENT_ID,
        clientName: "Engaged Client",
        clientEmail: "",
        completionPct: 60,
        completedCount: 6,
        totalCount: 10,
        lastActivityAt: new Date("2026-06-01"),
        blockedCount: 1,
        isStalled: false,
      },
    ]);

    const snapshot = await buildExecutiveReportSnapshot(CLIENT_ID, ADVISOR_PROFILE_ID);

    expect(snapshot.engagementSummary).not.toBeNull();
    expect(snapshot.engagementSummary?.milestoneCompletionPct).toBe(60);
    expect(snapshot.engagementSummary?.totalMilestones).toBe(10);
    expect(snapshot.engagementSummary?.completedMilestones).toBe(6);
  });

  it("returns correct reporting period label format", async () => {
    // Use noon UTC to avoid timezone-related day boundary issues in format()
    const periodStart = new Date("2026-01-15T12:00:00.000Z");
    const periodEnd = new Date("2026-06-15T12:00:00.000Z");
    const assessment = makeAssessment("assessment-1", {
      startedAt: periodStart,
    });
    vi.mocked(prisma.assessment.findMany).mockResolvedValue([assessment] as never);
    vi.mocked(prisma.assessment.findUnique).mockResolvedValue({
      previousAssessmentId: null,
      user: { name: "Test" },
    } as never);

    const snapshot = await buildExecutiveReportSnapshot(CLIENT_ID, ADVISOR_PROFILE_ID, {
      periodStart,
      periodEnd,
    });

    // Verify the label contains month names and year (exact format depends on local timezone)
    expect(snapshot.reportingPeriod.label).toMatch(/January .* 2026 - June .* 2026/);
  });
});
