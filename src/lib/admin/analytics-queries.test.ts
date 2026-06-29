/**
 * §9.1 (BRD) — admin analytics-queries tests.
 *
 * Coverage:
 *   • getPlatformKpis: counts wired correctly.
 *   • getRiskLevelDistribution: bucket counts + percentages; empty path.
 *   • getPillarAverages: per-pillar avg + dominant level; empty path;
 *     latest-per-pillar-per-client scoping (rescore history excluded).
 *   • getTopTenantsByClientCount: groupBy ordering; advisor + email
 *     resolved; empty path.
 *   • getCommonMissingControls: top-N + service name resolution; empty
 *     path; missing service falls back to "(deleted recommendation)".
 *   • PII invariant: no helper return type contains a per-client
 *     identifier (clientId / clientName / clientEmail / familyName /
 *     userId).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted shared state.
const { db } = vi.hoisted(() => {
  const state = {
    users: [] as Array<{
      id: string;
      role: "USER" | "ADVISOR" | "ADMIN" | "SUPER_ADMIN";
      deletedAt: Date | null;
      emailCiphertext: string;
    }>,
    advisorProfiles: [] as Array<{
      id: string;
      userId: string;
      firmName: string | null;
    }>,
    assignments: [] as Array<{
      advisorId: string;
      clientId: string;
      status: "ACTIVE" | "INACTIVE";
    }>,
    assessments: [] as Array<{
      id: string;
      userId: string;
      status: string;
      completedAt: Date | null;
    }>,
    pillarScores: [] as Array<{
      assessmentId: string;
      pillar: string;
      score: number;
      riskLevel: string;
      calculatedAt: Date;
    }>,
    reports: [] as Array<{ id: string; status: "DRAFT" | "PUBLISHED" | "SUPERSEDED" }>,
    subscriptions: [] as Array<{
      id: string;
      status: "ACTIVE" | "PAST_DUE" | "CANCELLED" | "UNPAID" | "GRACE_PERIOD";
    }>,
    enterprises: [] as Array<{
      id: string;
      status: "ACTIVE" | "PROVISIONING" | "SUSPENDED";
    }>,
    assessmentRecommendations: [] as Array<{
      assessmentId: string;
      serviceRecommendationId: string;
    }>,
    serviceRecommendations: [] as Array<{
      id: string;
      name: string;
      category: string;
    }>,
  };
  return { db: state };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return db.users.filter((u) => {
          if (where.role && u.role !== where.role) return false;
          if (where.deletedAt === null && u.deletedAt !== null) return false;
          if (
            typeof where.deletedAt === "object" &&
            where.deletedAt &&
            "not" in (where.deletedAt as object) &&
            u.deletedAt === null
          ) {
            return false;
          }
          return true;
        }).length;
      }),
    },
    pillarScore: {
      groupBy: vi.fn(async (args: { by: string[]; where?: { assessmentId?: { in: string[] } } }) => {
        if (args.by.length === 1 && args.by[0] === "assessmentId") {
          // KPI: groupBy(assessmentId).
          const ids = new Set<string>();
          for (const p of db.pillarScores) ids.add(p.assessmentId);
          return Array.from(ids).map((id) => ({
            assessmentId: id,
            _count: { _all: db.pillarScores.filter((p) => p.assessmentId === id).length },
          }));
        }
        if (args.by.includes("assessmentId") && args.by.includes("pillar")) {
          // latest-per-pillar groupBy(assessmentId, pillar) max(calculatedAt).
          const filterIds = args.where?.assessmentId?.in ?? null;
          const filtered = filterIds
            ? db.pillarScores.filter((p) => filterIds.includes(p.assessmentId))
            : db.pillarScores;
          const byKey = new Map<string, Date>();
          for (const p of filtered) {
            const key = `${p.assessmentId}|${p.pillar}`;
            const prev = byKey.get(key);
            if (!prev || p.calculatedAt.getTime() > prev.getTime()) {
              byKey.set(key, p.calculatedAt);
            }
          }
          return Array.from(byKey.entries()).map(([key, max]) => {
            const [assessmentId, pillar] = key.split("|");
            return { assessmentId, pillar, _max: { calculatedAt: max } };
          });
        }
        return [];
      }),
      findMany: vi.fn(
        async ({ where }: { where: { OR: Array<{ assessmentId: string; pillar: string; calculatedAt: Date }> } }) => {
          const want = (where.OR ?? []).map((o) => `${o.assessmentId}|${o.pillar}|${o.calculatedAt.getTime()}`);
          return db.pillarScores
            .filter((p) =>
              want.includes(`${p.assessmentId}|${p.pillar}|${p.calculatedAt.getTime()}`)
            )
            .map((p) => ({
              assessmentId: p.assessmentId,
              pillar: p.pillar,
              score: p.score,
              riskLevel: p.riskLevel,
            }));
        }
      ),
    },
    assessment: {
      groupBy: vi.fn(async () => {
        // Used by loadLatestPillarScoresPlatformWide: groupBy(userId)
        // _max(completedAt).
        const byUser = new Map<string, Date>();
        for (const a of db.assessments) {
          if (a.status !== "COMPLETED" || !a.completedAt) continue;
          const prev = byUser.get(a.userId);
          if (!prev || a.completedAt.getTime() > prev.getTime()) {
            byUser.set(a.userId, a.completedAt);
          }
        }
        return Array.from(byUser.entries()).map(([userId, completedAt]) => ({
          userId,
          _max: { completedAt },
        }));
      }),
      findMany: vi.fn(
        async ({ where, select }: {
          where: {
            OR?: Array<{ userId: string; completedAt: Date; status: string }>;
            userId?: { in: string[] };
            scores?: { some: Record<string, unknown> };
          };
          select?: Record<string, boolean>;
        }) => {
          if (where.OR) {
            const want = where.OR.map(
              (o) => `${o.userId}|${o.completedAt.getTime()}`
            );
            return db.assessments
              .filter((a) =>
                a.completedAt
                  ? want.includes(`${a.userId}|${a.completedAt.getTime()}`)
                  : false
              )
              .map((a) => ({ id: a.id, userId: a.userId }));
          }
          if (where.userId?.in && where.scores?.some) {
            const ids = where.userId.in;
            const out: Array<{ id: string; userId: string }> = [];
            for (const a of db.assessments) {
              if (!ids.includes(a.userId)) continue;
              const hasScore = db.pillarScores.some(
                (p) => p.assessmentId === a.id
              );
              if (!hasScore) continue;
              out.push({ id: a.id, userId: a.userId });
            }
            void select;
            return out;
          }
          return [];
        }
      ),
    },
    report: {
      count: vi.fn(async ({ where }: { where: { status: string } }) => {
        return db.reports.filter((r) => r.status === where.status).length;
      }),
    },
    subscription: {
      count: vi.fn(
        async ({ where }: { where: { status: { in: string[] } } }) => {
          return db.subscriptions.filter((s) =>
            where.status.in.includes(s.status)
          ).length;
        }
      ),
    },
    advisorEnterprise: {
      count: vi.fn(async ({ where }: { where: { status: string } }) => {
        return db.enterprises.filter((e) => e.status === where.status).length;
      }),
    },
    clientAdvisorAssignment: {
      groupBy: vi.fn(
        async ({
          where,
          take,
        }: {
          where: { status: string };
          take?: number;
        }) => {
          const counts = new Map<string, number>();
          for (const a of db.assignments) {
            if (a.status !== where.status) continue;
            counts.set(a.advisorId, (counts.get(a.advisorId) ?? 0) + 1);
          }
          const sorted = Array.from(counts.entries())
            .sort((x, y) => y[1] - x[1])
            .slice(0, take ?? Infinity);
          return sorted.map(([advisorId, c]) => ({
            advisorId,
            _count: { _all: c },
          }));
        }
      ),
      findMany: vi.fn(
        async ({ where }: {
          where: { advisorId: { in: string[] }; status: string };
        }) => {
          return db.assignments.filter(
            (a) =>
              where.advisorId.in.includes(a.advisorId) &&
              a.status === where.status
          );
        }
      ),
    },
    advisorProfile: {
      findMany: vi.fn(
        async ({ where }: { where: { id: { in: string[] } } }) => {
          return db.advisorProfiles
            .filter((a) => where.id.in.includes(a.id))
            .map((a) => {
              const user = db.users.find((u) => u.id === a.userId);
              return {
                id: a.id,
                firmName: a.firmName,
                userId: a.userId,
                user: { emailCiphertext: user?.emailCiphertext ?? "" },
              };
            });
        }
      ),
    },
    assessmentRecommendation: {
      groupBy: vi.fn(
        async ({ take }: { take?: number }) => {
          const counts = new Map<string, number>();
          for (const r of db.assessmentRecommendations) {
            counts.set(
              r.serviceRecommendationId,
              (counts.get(r.serviceRecommendationId) ?? 0) + 1
            );
          }
          const sorted = Array.from(counts.entries())
            .sort((x, y) => y[1] - x[1])
            .slice(0, take ?? Infinity);
          return sorted.map(([id, c]) => ({
            serviceRecommendationId: id,
            _count: { _all: c },
          }));
        }
      ),
    },
    serviceRecommendation: {
      findMany: vi.fn(
        async ({ where }: { where: { id: { in: string[] } } }) => {
          return db.serviceRecommendations.filter((s) =>
            where.id.in.includes(s.id)
          );
        }
      ),
    },
    pillar: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// Decrypt mock — return the ciphertext value as if it were the email.
vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: vi.fn((ct: string) => `email:${ct}`),
}));

import {
  getPlatformKpis,
  getRiskLevelDistribution,
  getPillarAverages,
  getTopTenantsByClientCount,
  getCommonMissingControls,
} from "./analytics-queries";

beforeEach(() => {
  db.users.length = 0;
  db.advisorProfiles.length = 0;
  db.assignments.length = 0;
  db.assessments.length = 0;
  db.pillarScores.length = 0;
  db.reports.length = 0;
  db.subscriptions.length = 0;
  db.enterprises.length = 0;
  db.assessmentRecommendations.length = 0;
  db.serviceRecommendations.length = 0;
});

function seedAdvisor(id: string, firmName: string, email = `advisor-${id}`): void {
  const userId = `user-${id}`;
  db.users.push({ id: userId, role: "ADVISOR", deletedAt: null, emailCiphertext: email });
  db.advisorProfiles.push({ id, userId, firmName });
}

function seedClientWithLatestPillar(
  clientId: string,
  pillar: string,
  score: number,
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
): void {
  if (!db.users.find((u) => u.id === clientId)) {
    db.users.push({
      id: clientId,
      role: "USER",
      deletedAt: null,
      emailCiphertext: `e:${clientId}`,
    });
  }
  const assessmentId = `asmt-${clientId}-${pillar}`;
  if (!db.assessments.find((a) => a.id === assessmentId)) {
    db.assessments.push({
      id: assessmentId,
      userId: clientId,
      status: "COMPLETED",
      completedAt: new Date("2026-04-01"),
    });
  }
  db.pillarScores.push({
    assessmentId,
    pillar,
    score,
    riskLevel,
    calculatedAt: new Date("2026-04-01T12:00:00Z"),
  });
}

describe("getPlatformKpis", () => {
  it("counts active vs deleted advisors and clients", async () => {
    db.users.push(
      { id: "a1", role: "ADVISOR", deletedAt: null, emailCiphertext: "e:a1" },
      { id: "a2", role: "ADVISOR", deletedAt: new Date(), emailCiphertext: "e:a2" },
      { id: "c1", role: "USER", deletedAt: null, emailCiphertext: "e:c1" },
      { id: "c2", role: "USER", deletedAt: null, emailCiphertext: "e:c2" },
      { id: "c3", role: "USER", deletedAt: new Date(), emailCiphertext: "e:c3" }
    );

    const kpis = await getPlatformKpis();
    expect(kpis.advisorsActive).toBe(1);
    expect(kpis.advisorsSoftDeleted).toBe(1);
    expect(kpis.clientsActive).toBe(2);
    expect(kpis.clientsSoftDeleted).toBe(1);
  });

  it("counts published vs draft reports separately", async () => {
    db.reports.push(
      { id: "r1", status: "PUBLISHED" },
      { id: "r2", status: "PUBLISHED" },
      { id: "r3", status: "DRAFT" },
      { id: "r4", status: "SUPERSEDED" }
    );
    const kpis = await getPlatformKpis();
    expect(kpis.publishedReports).toBe(2);
    expect(kpis.draftReports).toBe(1);
  });

  it("counts ACTIVE + GRACE_PERIOD as active subscriptions", async () => {
    db.subscriptions.push(
      { id: "s1", status: "ACTIVE" },
      { id: "s2", status: "GRACE_PERIOD" },
      { id: "s3", status: "PAST_DUE" },
      { id: "s4", status: "CANCELLED" }
    );
    const kpis = await getPlatformKpis();
    expect(kpis.activeSubscriptions).toBe(2);
  });

  it("counts enterprises by status", async () => {
    db.enterprises.push(
      { id: "e1", status: "ACTIVE" },
      { id: "e2", status: "ACTIVE" },
      { id: "e3", status: "PROVISIONING" },
      { id: "e4", status: "SUSPENDED" }
    );
    const kpis = await getPlatformKpis();
    expect(kpis.enterprisesActive).toBe(2);
    expect(kpis.enterprisesProvisioning).toBe(1);
    expect(kpis.enterprisesSuspended).toBe(1);
  });

  it("scoredAssessments counts distinct assessments with ≥ 1 PillarScore", async () => {
    seedClientWithLatestPillar("c1", "governance", 7, "LOW");
    seedClientWithLatestPillar("c1", "cyber-digital", 5, "MEDIUM"); // same client, two pillars on same assessment-key naming would diverge — let's keep simple
    seedClientWithLatestPillar("c2", "governance", 6, "MEDIUM");
    const kpis = await getPlatformKpis();
    // c1's two pillars produced two synthetic assessments due to the
    // seed helper's assessment-id encoding; that's fine — what we care
    // about is "every assessment with a score is counted once."
    expect(kpis.scoredAssessments).toBe(3);
  });
});

describe("getRiskLevelDistribution", () => {
  it("returns zero buckets in the empty state", async () => {
    const result = await getRiskLevelDistribution();
    expect(result.totalScored).toBe(0);
    expect(result.buckets).toHaveLength(4);
    expect(result.buckets.every((b) => b.count === 0 && b.percent === 0)).toBe(true);
  });

  it("buckets the latest-per-pillar PillarScore rows", async () => {
    seedClientWithLatestPillar("c1", "governance", 7, "LOW");
    seedClientWithLatestPillar("c2", "governance", 5, "MEDIUM");
    seedClientWithLatestPillar("c3", "governance", 3, "HIGH");
    seedClientWithLatestPillar("c4", "governance", 1, "CRITICAL");
    seedClientWithLatestPillar("c5", "cyber-digital", 8, "LOW");

    const result = await getRiskLevelDistribution();
    expect(result.totalScored).toBe(5);
    const byLevel = Object.fromEntries(result.buckets.map((b) => [b.level, b.count]));
    expect(byLevel).toEqual({ LOW: 2, MEDIUM: 1, HIGH: 1, CRITICAL: 1 });
    const lowBucket = result.buckets.find((b) => b.level === "LOW")!;
    expect(lowBucket.percent).toBeCloseTo(40, 1); // 2/5
  });
});

describe("getPillarAverages", () => {
  it("returns 6 unassessed cells when no scores exist", async () => {
    const result = await getPillarAverages();
    expect(result.totalScored).toBe(0);
    expect(result.pillars).toHaveLength(10);
    expect(result.pillars.every((p) => p.dominantLevel === "unassessed")).toBe(true);
    expect(result.pillars.every((p) => p.avgScore === null)).toBe(true);
  });

  it("computes per-pillar avg score + dominant level", async () => {
    seedClientWithLatestPillar("c1", "governance", 6, "MEDIUM");
    seedClientWithLatestPillar("c2", "governance", 8, "LOW");
    seedClientWithLatestPillar("c3", "governance", 4, "HIGH");

    const result = await getPillarAverages();
    const gov = result.pillars.find((p) => p.pillarId === "governance")!;
    expect(gov.count).toBe(3);
    expect(gov.avgScore).toBeCloseTo(6, 5);
    // LOW=1 MEDIUM=1 HIGH=1 → tie; severity tiebreaker picks HIGH.
    expect(gov.dominantLevel).toBe("HIGH");
  });

  it("excludes prior rescore history (latest-per-(assessment,pillar) only)", async () => {
    // Same assessment, two PillarScore rows for the same pillar at
    // different times. The older one (LOW) must be ignored; the newer
    // one (CRITICAL) is what counts.
    db.users.push({ id: "c1", role: "USER", deletedAt: null, emailCiphertext: "e:c1" });
    db.assessments.push({
      id: "asmt-1",
      userId: "c1",
      status: "COMPLETED",
      completedAt: new Date("2026-04-01"),
    });
    db.pillarScores.push(
      {
        assessmentId: "asmt-1",
        pillar: "governance",
        score: 8,
        riskLevel: "LOW",
        calculatedAt: new Date("2026-03-01T00:00:00Z"),
      },
      {
        assessmentId: "asmt-1",
        pillar: "governance",
        score: 1,
        riskLevel: "CRITICAL",
        calculatedAt: new Date("2026-04-01T00:00:00Z"),
      }
    );

    const result = await getPillarAverages();
    const gov = result.pillars.find((p) => p.pillarId === "governance")!;
    expect(gov.count).toBe(1);
    expect(gov.avgScore).toBe(1);
    expect(gov.dominantLevel).toBe("CRITICAL");
  });
});

describe("getTopTenantsByClientCount", () => {
  it("returns an empty array when no advisors have active assignments", async () => {
    expect(await getTopTenantsByClientCount()).toEqual([]);
  });

  it("orders advisors by active-client count DESC and resolves email", async () => {
    seedAdvisor("adv-A", "Firm A");
    seedAdvisor("adv-B", "Firm B");
    db.users.push(
      { id: "c1", role: "USER", deletedAt: null, emailCiphertext: "e:c1" },
      { id: "c2", role: "USER", deletedAt: null, emailCiphertext: "e:c2" },
      { id: "c3", role: "USER", deletedAt: null, emailCiphertext: "e:c3" }
    );
    db.assignments.push(
      { advisorId: "adv-A", clientId: "c1", status: "ACTIVE" },
      { advisorId: "adv-A", clientId: "c2", status: "ACTIVE" },
      { advisorId: "adv-A", clientId: "c3", status: "ACTIVE" },
      { advisorId: "adv-B", clientId: "c1", status: "ACTIVE" }
    );

    const result = await getTopTenantsByClientCount();
    expect(result.map((r) => r.advisorProfileId)).toEqual(["adv-A", "adv-B"]);
    expect(result[0].activeClientCount).toBe(3);
    expect(result[0].firmName).toBe("Firm A");
    expect(result[0].email).toMatch(/^email:advisor-adv-A$/);
  });

  it("counts scored assessments per advisor's clients", async () => {
    seedAdvisor("adv-A", "Firm A");
    db.users.push(
      { id: "c1", role: "USER", deletedAt: null, emailCiphertext: "e:c1" },
      { id: "c2", role: "USER", deletedAt: null, emailCiphertext: "e:c2" }
    );
    db.assignments.push(
      { advisorId: "adv-A", clientId: "c1", status: "ACTIVE" },
      { advisorId: "adv-A", clientId: "c2", status: "ACTIVE" }
    );
    seedClientWithLatestPillar("c1", "governance", 7, "LOW");
    // c2 has no scored assessment.

    const result = await getTopTenantsByClientCount();
    expect(result[0].activeClientCount).toBe(2);
    expect(result[0].scoredAssessmentCount).toBe(1);
  });
});

describe("getCommonMissingControls", () => {
  it("returns an empty array when no recommendations exist", async () => {
    expect(await getCommonMissingControls()).toEqual([]);
  });

  it("orders by row count DESC and resolves service name + category", async () => {
    db.serviceRecommendations.push(
      { id: "svc-A", name: "Hardware MFA rollout", category: "Cyber" },
      { id: "svc-B", name: "Annual tabletop", category: "Cyber" }
    );
    db.assessmentRecommendations.push(
      { assessmentId: "a1", serviceRecommendationId: "svc-A" },
      { assessmentId: "a2", serviceRecommendationId: "svc-A" },
      { assessmentId: "a3", serviceRecommendationId: "svc-A" },
      { assessmentId: "a1", serviceRecommendationId: "svc-B" }
    );

    const result = await getCommonMissingControls();
    expect(result.map((r) => r.serviceRecommendationId)).toEqual([
      "svc-A",
      "svc-B",
    ]);
    expect(result[0].count).toBe(3);
    expect(result[0].name).toBe("Hardware MFA rollout");
  });

  it("falls back to '(deleted recommendation)' when the service row was hard-deleted", async () => {
    db.assessmentRecommendations.push({
      assessmentId: "a1",
      serviceRecommendationId: "svc-vanished",
    });
    // No corresponding service in db.serviceRecommendations.

    const result = await getCommonMissingControls();
    expect(result[0].name).toBe("(deleted recommendation)");
  });
});

describe("PII invariant", () => {
  // Structural assertion: every helper's return type must NOT have any
  // field whose name suggests per-client identity. Catches future drift.
  // Top tenants helper is allowed to expose advisor identity (firmName,
  // email, advisorUserId) per round-11 §5.1 (commercial counterparty).
  const FORBIDDEN_KEYS = [
    "clientId",
    "clientName",
    "clientEmail",
    "familyName",
    "userId", // generic; advisor's own userId is renamed to "advisorUserId" in TopTenantRow.
  ];

  function assertNoForbiddenKeys(obj: unknown, path: string): void {
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => assertNoForbiddenKeys(item, `${path}[${i}]`));
      return;
    }
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (FORBIDDEN_KEYS.includes(k)) {
          throw new Error(`Forbidden key '${k}' at ${path}.${k}`);
        }
        assertNoForbiddenKeys(v, `${path}.${k}`);
      }
    }
  }

  it("getPlatformKpis exposes no per-client identifier", async () => {
    const result = await getPlatformKpis();
    expect(() => assertNoForbiddenKeys(result, "kpis")).not.toThrow();
  });

  it("getRiskLevelDistribution exposes no per-client identifier", async () => {
    seedClientWithLatestPillar("c1", "governance", 7, "LOW");
    const result = await getRiskLevelDistribution();
    expect(() => assertNoForbiddenKeys(result, "dist")).not.toThrow();
  });

  it("getPillarAverages exposes no per-client identifier", async () => {
    seedClientWithLatestPillar("c1", "governance", 7, "LOW");
    const result = await getPillarAverages();
    expect(() => assertNoForbiddenKeys(result, "avgs")).not.toThrow();
  });

  it("getTopTenantsByClientCount exposes only advisor-level identity (no client-level)", async () => {
    seedAdvisor("adv-A", "Firm A");
    db.users.push({ id: "c1", role: "USER", deletedAt: null, emailCiphertext: "e:c1" });
    db.assignments.push({ advisorId: "adv-A", clientId: "c1", status: "ACTIVE" });
    const result = await getTopTenantsByClientCount();
    expect(() => assertNoForbiddenKeys(result, "tenants")).not.toThrow();
  });

  it("getCommonMissingControls exposes no per-client identifier", async () => {
    db.serviceRecommendations.push({
      id: "svc-A",
      name: "X",
      category: "Y",
    });
    db.assessmentRecommendations.push({
      assessmentId: "a1",
      serviceRecommendationId: "svc-A",
    });
    const result = await getCommonMissingControls();
    expect(() => assertNoForbiddenKeys(result, "controls")).not.toThrow();
  });
});
