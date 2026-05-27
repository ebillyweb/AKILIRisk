/**
 * Platform risk signals — aggregation + PII invariant tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { loadLatestPillarScoresByClient, db } = vi.hoisted(() => {
  const loadLatestPillarScoresByClient = vi.fn<
    () => Promise<
      Array<{
        userId: string;
        pillar: string;
        score: number;
        riskLevel: string;
      }>
    >
  >();

  const db = {
    assignments: [] as Array<{
      advisorId: string;
      clientId: string;
      status: "ACTIVE" | "INACTIVE";
    }>,
    advisorProfiles: [] as Array<{
      id: string;
      userId: string;
      firmName: string | null;
      user: { emailCiphertext: string };
    }>,
  };

  return { loadLatestPillarScoresByClient, db };
});

vi.mock("@/lib/admin/analytics-queries", () => ({
  loadLatestPillarScoresByClient,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    clientAdvisorAssignment: {
      findMany: vi.fn(async () =>
        db.assignments.filter((a) => a.status === "ACTIVE")
      ),
    },
    advisorProfile: {
      findMany: vi.fn(
        async ({ where }: { where: { id: { in: string[] } } }) => {
          return db.advisorProfiles.filter((p) =>
            where.id.in.includes(p.id)
          );
        }
      ),
    },
  },
}));

vi.mock("@/lib/auth/user-email", () => ({
  decryptUserEmail: (cipher: string) => `email:${cipher}`,
}));

import { getPlatformRiskSignals } from "./risk-signals-queries";

describe("getPlatformRiskSignals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.assignments = [];
    db.advisorProfiles = [];
    loadLatestPillarScoresByClient.mockResolvedValue([]);
  });

  it("returns empty aggregates when no scored clients exist", async () => {
    const result = await getPlatformRiskSignals();
    expect(result.summary.familiesWithAssessment).toBe(0);
    expect(result.summary.familiesAtRisk).toBe(0);
    expect(result.topTenantsByRisk).toEqual([]);
    expect(result.pillars.length).toBeGreaterThan(0);
  });

  it("counts families at risk and severity buckets from latest pillar scores", async () => {
    loadLatestPillarScoresByClient.mockResolvedValue([
      { userId: "c1", pillar: "governance", score: 2.5, riskLevel: "CRITICAL" },
      { userId: "c1", pillar: "cyber-digital", score: 8, riskLevel: "LOW" },
      { userId: "c2", pillar: "governance", score: 4.5, riskLevel: "MEDIUM" },
      { userId: "c2", pillar: "insurance", score: 9, riskLevel: "LOW" },
    ]);

    const result = await getPlatformRiskSignals();

    expect(result.summary.familiesWithAssessment).toBe(2);
    expect(result.summary.familiesAtRisk).toBe(2);
    expect(result.summary.criticalIndicators).toBe(1);
    expect(result.summary.moderateIndicators).toBe(1);
    expect(result.bySeverity.critical).toBe(1);
    expect(result.bySeverity.moderate).toBe(1);
    expect(result.bySeverity.low).toBe(2);
    expect(result.risksByCategory.governance).toBe(2);
  });

  it("ranks pillars by families at risk descending", async () => {
    loadLatestPillarScoresByClient.mockResolvedValue([
      { userId: "c1", pillar: "governance", score: 2, riskLevel: "CRITICAL" },
      { userId: "c2", pillar: "governance", score: 2.5, riskLevel: "CRITICAL" },
      { userId: "c1", pillar: "cyber-digital", score: 4, riskLevel: "MEDIUM" },
    ]);

    const result = await getPlatformRiskSignals();
    const governance = result.pillars.find((p) => p.pillarId === "governance");
    const cyber = result.pillars.find((p) => p.pillarId === "cyber-digital");
    expect(governance?.familiesAtRisk).toBe(2);
    expect(cyber?.familiesAtRisk).toBe(1);
    expect(result.pillars[0].pillarId).toBe("governance");
  });

  it("ranks tenants by families at risk and resolves advisor identity", async () => {
    loadLatestPillarScoresByClient.mockResolvedValue([
      { userId: "c1", pillar: "governance", score: 2, riskLevel: "CRITICAL" },
      { userId: "c2", pillar: "governance", score: 8, riskLevel: "LOW" },
      { userId: "c3", pillar: "governance", score: 2.5, riskLevel: "CRITICAL" },
    ]);
    db.assignments.push(
      { advisorId: "adv-A", clientId: "c1", status: "ACTIVE" },
      { advisorId: "adv-A", clientId: "c2", status: "ACTIVE" },
      { advisorId: "adv-B", clientId: "c3", status: "ACTIVE" }
    );
    db.advisorProfiles.push(
      {
        id: "adv-A",
        userId: "user-A",
        firmName: "Firm A",
        user: { emailCiphertext: "adv-A" },
      },
      {
        id: "adv-B",
        userId: "user-B",
        firmName: "Firm B",
        user: { emailCiphertext: "adv-B" },
      }
    );

    const result = await getPlatformRiskSignals();
    expect(result.topTenantsByRisk.map((r) => r.advisorProfileId)).toEqual([
      "adv-A",
      "adv-B",
    ]);
    expect(result.topTenantsByRisk[0].familiesAtRisk).toBe(1);
    expect(result.topTenantsByRisk[0].familiesWithAssessment).toBe(2);
    expect(result.topTenantsByRisk[0].email).toBe("email:adv-A");
  });
});

describe("PII invariant (risk signals)", () => {
  const FORBIDDEN_KEYS = [
    "clientId",
    "clientName",
    "clientEmail",
    "familyName",
    "userId",
    "familyId",
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

  it("getPlatformRiskSignals exposes no per-client identifier", async () => {
    loadLatestPillarScoresByClient.mockResolvedValue([
      { userId: "c1", pillar: "governance", score: 2, riskLevel: "CRITICAL" },
    ]);
    db.assignments.push({
      advisorId: "adv-A",
      clientId: "c1",
      status: "ACTIVE",
    });
    db.advisorProfiles.push({
      id: "adv-A",
      userId: "user-A",
      firmName: "Firm",
      user: { emailCiphertext: "x" },
    });

    const result = await getPlatformRiskSignals();
    expect(() => assertNoForbiddenKeys(result, "signals")).not.toThrow();
  });
});
