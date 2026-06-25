import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
  GOVERNANCE_MID_BAND_NARRATIVES,
} from "@/lib/assessment/pillar-outcome-expectations";
import {
  buildAllNoVisiblePillarAnswers,
  buildHighestMaturityAnswers,
  scorePillar,
} from "@/lib/assessment/engines/recommendation-test-helpers";
import { belvedereQuestionsForPillar } from "@/lib/assessment/test-fixtures/belvedere-pillar-questions";

const { fakes } = vi.hoisted(() => {
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
    responses: [] as Array<{
      assessmentId: string;
      questionId: string;
      skipped: boolean;
      answer: string;
    }>,
  };
  return { fakes: state };
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
      findFirst: vi.fn(async ({ where }: { where: { assessmentId: string } }) => {
        const matches = fakes.pillarScores.filter((p) => p.assessmentId === where.assessmentId);
        return matches[0] ?? null;
      }),
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
      findMany: vi.fn(async ({ where }: { where: { assessmentId: string } }) =>
        fakes.pillarScores
          .filter((p) => p.assessmentId === where.assessmentId)
          .map((p) => ({
            pillar: p.pillar,
            score: p.score,
            riskLevel: p.riskLevel,
          }))
      ),
    },
    assessmentResponse: {
      count: vi.fn(async () => fakes.responses.length),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { assessmentId: string; skipped: boolean; questionId: { in: string[] } };
        }) => {
          return fakes.responses.filter(
            (r) =>
              r.assessmentId === where.assessmentId &&
              !where.skipped &&
              where.questionId.in.includes(r.questionId)
          );
        }
      ),
    },
    assessmentRecommendation: { findMany: vi.fn(async () => []) },
    householdMember: { findMany: vi.fn(async () => []) },
    clientAdvisorAssignment: { findFirst: vi.fn(async () => null) },
  },
}));

vi.mock("@/lib/household/member-profile", () => ({
  getHouseholdProfileForAdvisorView: vi.fn(async () => null),
}));

vi.mock("@/lib/assessment/pillar-config", async () => {
  const { belvedereQuestionsForPillar } = await import(
    "@/lib/assessment/test-fixtures/belvedere-pillar-questions"
  );
  const { pillarDefinitionFor } = await import("@/lib/assessment/pillar-registry");
  const { starterPillarCatalog } = await import("@/lib/methodology/pillar-catalog");
  const catalog = starterPillarCatalog();
  return {
    getPillarAssessmentConfig: async (pillarId: string) => ({
      pillarData: pillarDefinitionFor(pillarId, catalog),
      questions: belvedereQuestionsForPillar(pillarId),
    }),
  };
});

vi.mock("@/lib/methodology/assessment-runtime", async () => {
  const { belvedereQuestionsForPillar } = await import(
    "@/lib/assessment/test-fixtures/belvedere-pillar-questions"
  );
  const { pillarDefinitionFor } = await import("@/lib/assessment/pillar-registry");
  const { starterPillarCatalog } = await import("@/lib/methodology/pillar-catalog");
  const catalog = starterPillarCatalog();
  const { resolvePillarNarratives } = await import("@/lib/assessment/pillar-outcomes");
  return {
    resolvePillarConfigForAssessment: async (_assessmentId: string, pillarKey: string) => ({
      pillarData: pillarDefinitionFor(
        pillarKey === "family-governance" ? "governance" : pillarKey,
        catalog,
      ),
      questions: belvedereQuestionsForPillar(
        pillarKey === "family-governance" ? "governance" : pillarKey,
      ),
    }),
    resolvePillarNarrativesForAssessment: async (
      _assessmentId: string,
      pillarKey: string,
      score: number,
      riskLevel: string,
      answers: Record<string, unknown>,
    ) => {
      const slug = pillarKey === "family-governance" ? "governance" : pillarKey;
      const questions = belvedereQuestionsForPillar(slug);
      return resolvePillarNarratives(slug, score, riskLevel, answers, questions);
    },
  };
});

/** Plaintext answers in DB rows (no encryption in this test harness). */
vi.mock("@/lib/data/response-content", () => ({
  safeDecryptAnswer: (value: unknown) => value,
}));

import { buildReportSnapshot } from "./build-report-snapshot";

describe("buildReportSnapshot — pillar narratives (Belvedere fixtures)", () => {
  beforeEach(() => {
    fakes.assessment = {
      id: "asmt-gov",
      userId: "user-1",
      startedAt: new Date("2026-04-01T12:00:00Z"),
    };
    fakes.pillarScores = [];
    fakes.responses = [];
  });

  it("snapshots governance all-no canonical narrative copy", async () => {
    const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("governance");
    const score = scorePillar("governance", answers, visibleIds, questions);

    fakes.pillarScores.push({
      assessmentId: "asmt-gov",
      pillar: "governance",
      score: score.score,
      riskLevel: "CRITICAL",
      breakdown: score.breakdown,
      missingControls: score.missingControls,
      calculatedAt: new Date(),
    });

    for (const [questionId, answer] of Object.entries(answers)) {
      fakes.responses.push({
        assessmentId: "asmt-gov",
        questionId,
        skipped: false,
        answer: answer as unknown as string,
      });
    }

    const snap = await buildReportSnapshot("asmt-gov", { pillar: "governance" });

    expect(snap.reportData.pillarNarratives).toEqual([
      ...GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS,
    ]);
    expect(snap.reportData.missingControls.length).toBeGreaterThan(0);
    expect(belvedereQuestionsForPillar("governance").length).toBeGreaterThan(0);
  });

  it("snapshots governance mixed critical mid-band narrative copy", async () => {
    const { answers, visibleIds, questions } = buildAllNoVisiblePillarAnswers("governance");
    const highest = buildHighestMaturityAnswers(questions, visibleIds);
    const mixed = { ...answers, [visibleIds[0]]: highest[visibleIds[0]] };
    const score = scorePillar("governance", mixed, visibleIds, questions);

    fakes.pillarScores.push({
      assessmentId: "asmt-gov",
      pillar: "governance",
      score: score.score,
      riskLevel: "CRITICAL",
      breakdown: score.breakdown,
      missingControls: score.missingControls,
      calculatedAt: new Date(),
    });

    for (const [questionId, answer] of Object.entries(mixed)) {
      fakes.responses.push({
        assessmentId: "asmt-gov",
        questionId,
        skipped: false,
        answer: answer as unknown as string,
      });
    }

    const snap = await buildReportSnapshot("asmt-gov", { pillar: "governance" });

    expect(snap.reportData.pillarNarratives).toEqual([
      ...GOVERNANCE_MID_BAND_NARRATIVES.critical,
    ]);
    expect(snap.reportData.pillarNarratives[0]).not.toEqual(
      GOVERNANCE_ALL_NEGATIVE_NARRATIVE_RECOMMENDATIONS[0]
    );
  });
});
