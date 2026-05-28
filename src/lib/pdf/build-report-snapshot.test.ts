/**
 * §4.5 commit 3 (BRD §4.5) — buildReportSnapshot tests.
 *
 * Coverage:
 *   • Snapshot shape exactly matches AssessmentReport.data interface
 *     (compile-time via TS, runtime via structural assertion).
 *   • Falls back to legacy `pillarScore.missingControls` when no
 *     AssessmentRecommendation rows exist (mirrors commit 1).
 *   • Throws when assessment is unscored.
 *   • Severity bucket mapping matches the route's logic.
 *
 * vi.hoisted() pattern is the same as src/lib/auth/user-email.test.ts —
 * mutable per-test fake state is hoisted alongside the vi.mock factory.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { fakes, resolvePillarNarrativesSpy } = vi.hoisted(() => {
  const resolvePillarNarrativesSpy = vi.fn(() => [] as string[]);
  const state = {
    assessment: null as null | { id: string; userId: string; startedAt: Date },
    pillarScores: [] as Array<{
      assessmentId: string;
      pillar: string;
      score: number;
      riskLevel: string;
      breakdown: unknown;
      missingControls: unknown;
      calculatedAt: Date;
    }>,
    responses: [] as Array<{ assessmentId: string; skipped: boolean }>,
    householdMembers: [] as Array<{
      userId: string;
      displayLabel: string;
      birthYear: number | null;
      sex: string | null;
      relationship: string;
      governanceRoles: string[];
      isResident: boolean;
    }>,
    assessmentRecommendations: [] as Array<{
      assessmentId: string;
      priority: number;
      advisorNotes: string | null;
      serviceRecommendation: { name: string; description: string; category: string };
    }>,
  };
  return { fakes: state, resolvePillarNarrativesSpy };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (!fakes.assessment || fakes.assessment.id !== where.id) return null;
        return fakes.assessment;
      }),
    },
    pillarScore: {
      findUnique: vi.fn(
        async ({
          where,
        }: {
          where: { assessmentId_pillar: { assessmentId: string; pillar: string } };
        }) => {
          const k = where.assessmentId_pillar;
          return (
            fakes.pillarScores.find(
              (p) => p.assessmentId === k.assessmentId && p.pillar === k.pillar
            ) ?? null
          );
        }
      ),
      findFirst: vi.fn(
        async ({
          where,
          orderBy: _orderBy,
        }: {
          where: { assessmentId: string };
          orderBy: unknown;
        }) => {
          void _orderBy;
          const matches = fakes.pillarScores.filter(
            (p) => p.assessmentId === where.assessmentId
          );
          if (matches.length === 0) return null;
          // Mirror orderBy: { calculatedAt: "desc" }.
          return [...matches].sort(
            (a, b) => b.calculatedAt.getTime() - a.calculatedAt.getTime()
          )[0];
        }
      ),
      findMany: vi.fn(async ({ where }: { where: { assessmentId: string } }) => {
        return fakes.pillarScores
          .filter((p) => p.assessmentId === where.assessmentId)
          .map((p) => ({
            pillar: p.pillar,
            score: p.score,
            riskLevel: p.riskLevel,
          }));
      }),
    },
    assessmentResponse: {
      count: vi.fn(
        async ({ where }: { where: { assessmentId: string; skipped: boolean } }) => {
          return fakes.responses.filter(
            (r) => r.assessmentId === where.assessmentId && r.skipped === where.skipped
          ).length;
        }
      ),
    },
    householdMember: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        return fakes.householdMembers.filter((m) => m.userId === where.userId);
      }),
    },
    assessmentRecommendation: {
      findMany: vi.fn(async ({ where }: { where: { assessmentId: string } }) => {
        return fakes.assessmentRecommendations
          .filter((r) => r.assessmentId === where.assessmentId)
          .sort((a, b) => a.priority - b.priority);
      }),
    },
    clientAdvisorAssignment: {
      findFirst: vi.fn(async () => null),
    },
  },
}));

vi.mock("@/lib/pdf/branding-integration", () => ({
  getAdvisorBrandingForPDF: vi.fn(async () => null),
}));

vi.mock("@/lib/schemas/profile", () => ({
  RELATIONSHIP_LABELS: {
    SPOUSE: "Spouse",
    CHILD: "Child",
    PARENT: "Parent",
    DEPENDENT: "Dependent",
    OTHER: "Other",
  },
}));

vi.mock("@/lib/assessment/pillar-config", () => ({
  getPillarAssessmentConfig: vi.fn(async () => ({
    pillarData: { id: "cyber-digital", subCategories: [] },
    questions: [{ id: "belvedere-cyber-a1" }],
  })),
}));

vi.mock("@/lib/assessment/pillar-answer-loader", () => ({
  loadAssessmentAnswersForQuestions: vi.fn(async () => ({ "belvedere-cyber-a1": 0 })),
}));

vi.mock("@/lib/assessment/pillar-outcomes", () => ({
  resolvePillarNarratives: (...args: Parameters<typeof resolvePillarNarrativesSpy>) =>
    resolvePillarNarrativesSpy(...args),
}));

import { buildReportSnapshot } from "./build-report-snapshot";

beforeEach(() => {
  resolvePillarNarrativesSpy.mockReset();
  resolvePillarNarrativesSpy.mockReturnValue([]);
  fakes.assessment = null;
  fakes.pillarScores.length = 0;
  fakes.responses.length = 0;
  fakes.householdMembers.length = 0;
  fakes.assessmentRecommendations.length = 0;
});

function seedScoredAssessment(): void {
  fakes.assessment = {
    id: "asmt-1",
    userId: "user-1",
    startedAt: new Date("2026-03-04T12:00:00Z"),
  };
  fakes.pillarScores.push({
    assessmentId: "asmt-1",
    pillar: "cyber-digital",
    score: 6.5,
    riskLevel: "MEDIUM",
    breakdown: [
      { name: "Cyber", score: 6.5, maxScore: 10, subcategoryCount: 1 },
    ],
    missingControls: [
      {
        category: "Cyber",
        subcategory: "MFA",
        description: "MFA is not enabled on advisor accounts.",
        recommendation: "Roll out hardware-backed MFA.",
        severity: "high",
      },
    ],
    calculatedAt: new Date("2026-03-04T12:30:00Z"),
  });
  for (let i = 0; i < 50; i += 1) {
    fakes.responses.push({ assessmentId: "asmt-1", skipped: false });
  }
}

describe("buildReportSnapshot", () => {
  it("throws when the assessment has no PillarScore rows", async () => {
    fakes.assessment = {
      id: "asmt-empty",
      userId: "user-empty",
      startedAt: new Date(),
    };
    await expect(buildReportSnapshot("asmt-empty")).rejects.toThrow(
      /no PillarScore/
    );
  });

  it("throws when the assessment id is unknown", async () => {
    await expect(buildReportSnapshot("does-not-exist")).rejects.toThrow(
      /Assessment not found/
    );
  });

  it("snapshot shape matches the AssessmentReport.data interface (structural)", async () => {
    seedScoredAssessment();

    const snap = await buildReportSnapshot("asmt-1");

    expect(snap.schemaVersion).toBe(1);
    expect(snap.pillar).toBe("cyber-digital");
    expect(snap.householdProfile).toBeNull();

    // Structural parity with `AssessmentReportData` in
    // src/lib/pdf/components/AssessmentReport.tsx. If this assertion
    // breaks, either the snapshot or the renderer's interface drifted —
    // bump `schemaVersion` and add a read path for older snapshots.
    expect(Object.keys(snap.reportData).sort()).toEqual(
      [
        "score",
        "riskLevel",
        "breakdown",
        "missingControls",
        "pillarNarratives",
        "assessmentDate",
        "completionPercentage",
        "categoryCount",
        "missingControlsCount",
        "pillarScores",
      ].sort()
    );
    expect(snap.reportData.score).toBe(6.5);
    expect(snap.reportData.riskLevel).toBe("medium"); // lowercased
    expect(snap.reportData.completionPercentage).toBe(74); // 50/68 → 74
    expect(snap.reportData.pillarScores).toEqual([
      { pillar: "cyber-digital", score: 6.5, riskLevel: "MEDIUM" },
    ]);
  });

  it("falls back to legacy missingControls when no AssessmentRecommendation rows exist", async () => {
    seedScoredAssessment();
    // No assessmentRecommendations seeded.

    const snap = await buildReportSnapshot("asmt-1");

    expect(snap.reportData.missingControls).toHaveLength(1);
    expect(snap.reportData.missingControls[0]).toMatchObject({
      category: "Cyber",
      subcategory: "MFA",
      severity: "high",
    });
    // Legacy path emits no advisorNotes field.
    expect(snap.reportData.missingControls[0].advisorNotes).toBeUndefined();
  });

  it("prefers AssessmentRecommendation rows and surfaces advisorNotes", async () => {
    seedScoredAssessment();
    fakes.assessmentRecommendations.push(
      {
        assessmentId: "asmt-1",
        priority: 1,
        advisorNotes: "Aligns with the family's Q3 cyber priorities.",
        serviceRecommendation: {
          name: "Hardware MFA rollout",
          description: "Distribute YubiKeys to all primary decision-makers.",
          category: "Cyber",
        },
      },
      {
        assessmentId: "asmt-1",
        priority: 5,
        advisorNotes: null,
        serviceRecommendation: {
          name: "Annual cyber tabletop",
          description: "Run a tabletop exercise with the family office.",
          category: "Cyber",
        },
      },
      {
        assessmentId: "asmt-1",
        priority: 9,
        advisorNotes: null,
        serviceRecommendation: {
          name: "Encrypted backup audit",
          description: "Quarterly review of off-site encrypted backups.",
          category: "Cyber",
        },
      }
    );

    const snap = await buildReportSnapshot("asmt-1");

    expect(snap.reportData.missingControls).toHaveLength(3);
    // Priority-based severity mapping (1–3 high, 4–6 medium, 7+ low).
    expect(snap.reportData.missingControls[0].severity).toBe("high");
    expect(snap.reportData.missingControls[1].severity).toBe("medium");
    expect(snap.reportData.missingControls[2].severity).toBe("low");
    // Advisor notes flow through.
    expect(snap.reportData.missingControls[0].advisorNotes).toBe(
      "Aligns with the family's Q3 cyber priorities."
    );
    expect(snap.reportData.missingControls[1].advisorNotes).toBeUndefined();
  });

  it("populates householdProfile when members exist", async () => {
    seedScoredAssessment();
    fakes.householdMembers.push({
      userId: "user-1",
      displayLabel: "Member A",
      birthYear: 1972,
      sex: "FEMALE",
      relationship: "SPOUSE",
      governanceRoles: ["TRUSTEE"],
      isResident: true,
    });

    const snap = await buildReportSnapshot("asmt-1");

    expect(snap.householdProfile).not.toBeNull();
    expect(snap.householdProfile!.members).toHaveLength(1);
    expect(snap.householdProfile!.members[0].relationship).toBe("Spouse"); // pretty-labeled
  });

  it("includes pillarNarratives from resolvePillarNarratives", async () => {
    resolvePillarNarrativesSpy.mockReturnValueOnce([
      "Client operates without a formal cybersecurity framework.",
    ]);
    seedScoredAssessment();

    const snap = await buildReportSnapshot("asmt-1");

    expect(resolvePillarNarrativesSpy).toHaveBeenCalledWith(
      "cyber-digital",
      6.5,
      "MEDIUM",
      { "belvedere-cyber-a1": 0 },
      [{ id: "belvedere-cyber-a1" }]
    );
    expect(snap.reportData.pillarNarratives).toEqual([
      "Client operates without a formal cybersecurity framework.",
    ]);
  });

  it("respects an explicit pillar option", async () => {
    seedScoredAssessment();
    fakes.pillarScores.push({
      assessmentId: "asmt-1",
      pillar: "physical-security",
      score: 4.0,
      riskLevel: "HIGH",
      breakdown: [],
      missingControls: [],
      calculatedAt: new Date("2026-03-04T13:00:00Z"),
    });

    const snap = await buildReportSnapshot("asmt-1", {
      pillar: "physical-security",
    });

    expect(snap.pillar).toBe("physical-security");
    expect(snap.reportData.score).toBe(4.0);
    expect(snap.reportData.riskLevel).toBe("high");
  });
});
