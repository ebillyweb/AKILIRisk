import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * US-46c coverage: advisor assessment-review query is tenant-isolated AND
 * note-scoped to the calling advisor. These assertions pin the prisma call
 * shape so a future refactor that loosens either the assignment filter or
 * the `advisorNotes where advisorId` filter fails loudly.
 *
 * Specifically:
 *   1. The `responses.advisorNotes` join is filtered by the caller's user id
 *      (NOT all advisor notes on the response — co-advisors must not see
 *      each other's notes).
 *   2. The query does NOT touch the admin-note table — admins see admin
 *      notes via a separate `admin-assessment-review-queries.ts` query.
 *   3. The tenant gate (active client/advisor assignment) is wired into the
 *      `assessment.findFirst` where-clause: an advisor with no ACTIVE
 *      assignment gets `null` back, regardless of whether the assessment id
 *      is valid.
 */

const {
  prismaSpies,
  requireAdvisorRoleSpy,
  getAdvisorProfileOrThrowSpy,
  loadGovernanceQuestionsMergedSpy,
  decryptUserEmailSpy,
  safeDecryptAnswerSpy,
} = vi.hoisted(() => ({
  prismaSpies: {
    assessment: { findFirst: vi.fn() },
    advisorProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: "advisor-profile-1" }),
    },
    enterpriseMembership: { findFirst: vi.fn().mockResolvedValue(null) },
    subscription: { findUnique: vi.fn().mockResolvedValue(null) },
  },
  requireAdvisorRoleSpy: vi.fn().mockResolvedValue({
    userId: "advisor-user-1",
    email: "advisor@test.com",
    role: "ADVISOR",
  }),
  getAdvisorProfileOrThrowSpy: vi.fn().mockResolvedValue({
    id: "advisor-profile-1",
  }),
  loadGovernanceQuestionsMergedSpy: vi.fn().mockResolvedValue([]),
  decryptUserEmailSpy: vi.fn((_v: string) => "client@test.com"),
  safeDecryptAnswerSpy: vi.fn((v: unknown) => v),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/advisor/auth", () => ({
  requireAdvisorRole: () => requireAdvisorRoleSpy(),
  getAdvisorProfileOrThrow: (userId: string) =>
    getAdvisorProfileOrThrowSpy(userId),
}));
vi.mock("@/lib/assessment/bank/load-bank", () => ({
  loadGovernanceQuestionsMerged: (opts: { onlyVisible: boolean }) =>
    loadGovernanceQuestionsMergedSpy(opts),
}));
vi.mock("@/lib/auth/user-email-crypto", () => ({
  decryptUserEmail: (v: string) => decryptUserEmailSpy(v),
}));
vi.mock("@/lib/data/response-content", () => ({
  safeDecryptAnswer: (v: unknown, ctx: unknown) =>
    (safeDecryptAnswerSpy as (...args: unknown[]) => unknown)(v, ctx),
}));

import { getAssessmentForAdvisorReview } from "./assessment-review-queries";

beforeEach(() => {
  vi.clearAllMocks();
  requireAdvisorRoleSpy.mockResolvedValue({
    userId: "advisor-user-1",
    email: "advisor@test.com",
    role: "ADVISOR",
  });
  getAdvisorProfileOrThrowSpy.mockResolvedValue({ id: "advisor-profile-1" });
  loadGovernanceQuestionsMergedSpy.mockResolvedValue([]);
  decryptUserEmailSpy.mockReturnValue("client@test.com");
  safeDecryptAnswerSpy.mockImplementation((v: unknown) => v);
});

function mockAssessmentRow(overrides?: {
  advisorNotes?: Array<{ id: string; body: string; updatedAt: Date }>;
}) {
  prismaSpies.assessment.findFirst.mockResolvedValue({
    id: "as-1",
    status: "SUBMITTED",
    version: 1,
    completedAt: new Date("2026-05-01T00:00:00Z"),
    user: {
      id: "client-1",
      name: "Client One",
      emailCiphertext: "ct",
    },
    responses: [
      {
        id: "ar-1",
        questionId: "q-1",
        pillar: "governance",
        subCategory: "policies",
        answer: "an answer",
        skipped: false,
        answeredAt: new Date("2026-05-01T00:00:00Z"),
        advisorNotes: overrides?.advisorNotes ?? [],
      },
    ],
  });
}

describe("getAssessmentForAdvisorReview — tenant + note scoping (US-46c)", () => {
  it("filters the advisorNotes join to the calling advisor's user id only", async () => {
    mockAssessmentRow({
      advisorNotes: [
        {
          id: "note-1",
          body: "Caller's own note",
          updatedAt: new Date("2026-05-02T00:00:00Z"),
        },
      ],
    });

    await getAssessmentForAdvisorReview("as-1");

    expect(prismaSpies.assessment.findFirst).toHaveBeenCalledTimes(1);
    const args = prismaSpies.assessment.findFirst.mock.calls[0][0] as {
      select: {
        responses: {
          select: {
            advisorNotes: { where: { advisorId: string } };
          };
        };
      };
    };

    // The advisorNotes join must scope to the calling advisor's user id —
    // co-advisors on the same client get their OWN row, never each other's.
    expect(args.select.responses.select.advisorNotes.where).toEqual({
      advisorId: "advisor-user-1",
    });
  });

  it("does NOT join the admin-note table (advisors don't see admin notes per US-46b)", async () => {
    mockAssessmentRow();
    await getAssessmentForAdvisorReview("as-1");

    const args = prismaSpies.assessment.findFirst.mock.calls[0][0] as {
      select: { responses: { select: Record<string, unknown> } };
    };

    // Admin notes live on `AssessmentResponse.adminNote` (singular) — the
    // admin query in admin-assessment-review-queries selects it. The
    // advisor query must NOT include it.
    expect(args.select.responses.select.adminNote).toBeUndefined();
    expect(args.select.responses.select.adminNotes).toBeUndefined();
  });

  it("gates on ACTIVE client assignment — unassigned advisor gets null", async () => {
    // No assignment ⇒ findFirst returns null because the where clause
    // requires `user.clientAssignments.some({ advisorId, status: ACTIVE })`.
    prismaSpies.assessment.findFirst.mockResolvedValue(null);

    const result = await getAssessmentForAdvisorReview("as-1");

    expect(result).toBeNull();

    // Confirm the tenant gate is wired into the where-clause shape, not
    // applied as a post-fetch filter on the caller. If a refactor moves it
    // out of the query, this assertion fails loudly.
    const args = prismaSpies.assessment.findFirst.mock.calls[0][0] as {
      where: {
        id: string;
        user: {
          clientAssignments: {
            some: { advisorId: string; status: string };
          };
        };
      };
    };
    expect(args.where.user.clientAssignments.some).toEqual({
      advisorId: { in: ["advisor-profile-1"] },
      status: "ACTIVE",
    });
  });

  it("shapes the advisorNote into a single field (note present)", async () => {
    mockAssessmentRow({
      advisorNotes: [
        {
          id: "note-1",
          body: "The note",
          updatedAt: new Date("2026-05-02T00:00:00Z"),
        },
      ],
    });

    const result = await getAssessmentForAdvisorReview("as-1");
    expect(result).not.toBeNull();
    expect(result!.assessment.responses[0].advisorNote).toEqual({
      id: "note-1",
      body: "The note",
      updatedAt: "2026-05-02T00:00:00.000Z",
    });
  });

  it("returns advisorNote=null when the join produced no rows", async () => {
    mockAssessmentRow({ advisorNotes: [] });

    const result = await getAssessmentForAdvisorReview("as-1");
    expect(result).not.toBeNull();
    expect(result!.assessment.responses[0].advisorNote).toBeNull();
  });
});
