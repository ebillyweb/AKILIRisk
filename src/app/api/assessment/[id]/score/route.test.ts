import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Round-12 audit close-out: GET /api/assessment/[id]/score writes a
 * `DATA_ACCESS_OWN_ASSESSMENT_RESULTS` audit row on every successful
 * 200 response. The body of the route is unaffected — this test only
 * pins the new audit wire-in.
 */

const { authSpy, writeAuditSpy } = vi.hoisted(() => ({
  authSpy: vi.fn(),
  writeAuditSpy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => authSpy(...args),
}));

vi.mock("@/lib/audit/audit-log", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/audit/audit-log")>(
      "@/lib/audit/audit-log"
    );
  return {
    ...actual,
    writeAudit: (...args: unknown[]) => writeAuditSpy(...args),
  };
});

vi.mock("@/lib/assessment/pillar-config", () => ({
  getPillarAssessmentConfig: vi.fn(async () => ({
    questions: [{ id: "q-1", text: "Stub question" }],
  })),
}));

vi.mock("@/lib/assessment/pillar-answer-loader", () => ({
  loadAssessmentAnswersForQuestions: vi.fn(async () => ({})),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === "asmt-1") {
          return {
            userId: "user-owner",
            deliverablePhase: "PROFILE",
            includedPillars: ["governance"],
            scores: [{ pillar: "governance" }],
          };
        }
        if (where.id === "asmt-other") {
          return {
            userId: "user-other",
            deliverablePhase: "PROFILE",
            includedPillars: ["governance"],
            scores: [{ pillar: "governance" }],
          };
        }
        return null;
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
          if (
            k.assessmentId === "asmt-1" &&
            k.pillar === "governance"
          ) {
            return {
              score: 7.5,
              riskLevel: "MEDIUM",
              breakdown: [],
              missingControls: [],
              calculatedAt: new Date("2026-04-01T12:00:00Z"),
            };
          }
          return null;
        }
      ),
    },
  },
}));

import { GET } from "./route";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";

beforeEach(() => {
  authSpy.mockReset();
  writeAuditSpy.mockClear();
});

function makeRequest(url: string): never {
  return new Request(url, { method: "GET" }) as never;
}

const params = (id: string) => Promise.resolve({ id });

describe("GET /api/assessment/[id]/score audit wiring", () => {
  it("writes one DATA_ACCESS_OWN_ASSESSMENT_RESULTS row on a successful 200", async () => {
    authSpy.mockResolvedValue({
      user: { id: "user-owner", role: "USER", email: "owner@example.com" },
    });

    const res = await GET(
      makeRequest(
        "http://localhost/api/assessment/asmt-1/score?pillar=governance"
      ),
      { params: params("asmt-1") }
    );

    expect(res.status).toBe(200);
    expect(writeAuditSpy).toHaveBeenCalledTimes(1);
    const call = writeAuditSpy.mock.calls[0][0];
    expect(call.action).toBe(AUDIT_ACTIONS.DATA_ACCESS_OWN_ASSESSMENT_RESULTS);
    expect(call.entityType).toBe("Assessment");
    expect(call.entityId).toBe("asmt-1");
    expect(call.metadata).toEqual({
      assessmentId: "asmt-1",
      pillar: "governance",
    });
    expect(call.actor.userId).toBe("user-owner");
  });

  it("does NOT audit on 401 (unauthenticated)", async () => {
    authSpy.mockResolvedValue(null);

    const res = await GET(
      makeRequest("http://localhost/api/assessment/asmt-1/score"),
      { params: params("asmt-1") }
    );

    expect(res.status).toBe(401);
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("does NOT audit on 404 (cross-tenant access — owner mismatch)", async () => {
    authSpy.mockResolvedValue({
      user: { id: "user-owner", role: "USER", email: "owner@example.com" },
    });

    const res = await GET(
      makeRequest("http://localhost/api/assessment/asmt-other/score"),
      { params: params("asmt-other") }
    );

    expect(res.status).toBe(404);
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });

  it("does NOT audit on 404 (no PillarScore yet)", async () => {
    authSpy.mockResolvedValue({
      user: { id: "user-owner", role: "USER", email: "owner@example.com" },
    });

    const res = await GET(
      makeRequest(
        "http://localhost/api/assessment/asmt-1/score?pillar=cyber-digital"
      ),
      { params: params("asmt-1") }
    );

    expect(res.status).toBe(404);
    expect(writeAuditSpy).not.toHaveBeenCalled();
  });
});
