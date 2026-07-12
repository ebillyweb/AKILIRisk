/**
 * Round-11 bug-hunt fix (commit B / RISK 2 + RISK 3) — pin the
 * decrypt-at-query-exit contract for the two intake helpers that
 * the bug-hunt found returning ciphertext to UI consumers:
 *
 *   - getIntakeInterview          (lib/data/intake.ts)
 *   - getClientIntakeForReview    (lib/data/advisor.ts)
 *
 * Both fetch IntakeResponse rows whose `transcription` column has
 * been encrypted at rest since round-11 commit 2.5b. Without the
 * mapper, consumers (intake interview page; advisor review screen)
 * receive iv:tag:ct hex strings and render them verbatim.
 *
 * Pattern mirrors src/lib/audit/audit-actor-emailHash.test.ts: pin
 * ENCRYPTION_KEY in beforeEach, mock @/lib/db with a vi.hoisted
 * factory, then exercise the helpers and assert plaintext on the
 * way out.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const TEST_KEY = "test-key-do-not-use-in-prod-0123456789ABCDEF";

const { prismaSpies, portfolioSpies } = vi.hoisted(() => ({
  prismaSpies: {
    intakeInterview: { findFirst: vi.fn(), findUnique: vi.fn() },
    clientAdvisorAssignment: { findMany: vi.fn(), findFirst: vi.fn() },
    intakeApproval: { findUnique: vi.fn() },
    advisorProfile: { findUnique: vi.fn() },
  },
  portfolioSpies: {
    resolvePortfolioScope: vi.fn(),
    findPortfolioAssignmentForClient: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaSpies,
}));

vi.mock("@/lib/enterprise/portfolio-access", () => portfolioSpies);
vi.mock("@/lib/intake/reassign-misplaced-intake", () => ({
  maybeReassignMisplacedIntakeToClient: vi.fn(async () => {}),
}));

import { getIntakeInterview } from "./intake";
import { getClientIntakeForReview } from "./advisor";
import { encryptTranscription } from "./response-content";
import { userEmailCiphertext } from "@/lib/auth/user-email";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  prismaSpies.intakeInterview.findFirst.mockReset();
  prismaSpies.intakeInterview.findUnique.mockReset();
  prismaSpies.intakeInterview.findUnique.mockResolvedValue(null);
  prismaSpies.clientAdvisorAssignment.findMany.mockReset();
  prismaSpies.clientAdvisorAssignment.findMany.mockResolvedValue([]);
  prismaSpies.clientAdvisorAssignment.findFirst.mockReset();
  prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue({ id: "assignment-1" });
  prismaSpies.intakeApproval.findUnique.mockReset();
  prismaSpies.intakeApproval.findUnique.mockResolvedValue(null);
  prismaSpies.advisorProfile.findUnique.mockReset();
  prismaSpies.advisorProfile.findUnique.mockResolvedValue({
    piiPolicy: {
      schemaVersion: 1,
      fields: {
        "User.name": true,
        "ClientProfile.phone": true,
        "HouseholdMember.fullName": true,
        "HouseholdMember.phone": true,
        "HouseholdMember.notes": true,
      },
    },
  });
  portfolioSpies.resolvePortfolioScope.mockReset();
  portfolioSpies.resolvePortfolioScope.mockResolvedValue({
    mode: "assigned",
    advisorProfileId: "adv-1",
    enterpriseId: null,
    role: null,
  });
  portfolioSpies.findPortfolioAssignmentForClient.mockReset();
  portfolioSpies.findPortfolioAssignmentForClient.mockResolvedValue({
    assignmentAdvisorProfileId: "adv-1",
  });
});

describe("getIntakeInterview decrypt mapper", () => {
  it("decrypts response.transcription on the way out", async () => {
    const plain = "We meet quarterly with our advisor and document decisions.";
    prismaSpies.intakeInterview.findFirst.mockResolvedValue({
      id: "iv-1",
      userId: "u-1",
      status: "IN_PROGRESS",
      currentQuestionIndex: 0,
      startedAt: new Date(),
      completedAt: null,
      submittedAt: null,
      updatedAt: new Date(),
      responses: [
        {
          id: "ir-1",
          interviewId: "iv-1",
          questionId: "q-1",
          audioUrl: null,
          audioS3Key: null,
          audioContentType: null,
          audioDuration: null,
          transcription: encryptTranscription(plain),
          hasTranscription: true,
          transcriptionStatus: "COMPLETED",
          answeredAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const out = await getIntakeInterview("u-1", "iv-1");
    expect(out).not.toBeNull();
    expect(out!.responses[0].transcription).toBe(plain);
  });

  it("preserves null transcription rows (no decrypt attempt)", async () => {
    prismaSpies.intakeInterview.findFirst.mockResolvedValue({
      id: "iv-2",
      userId: "u-1",
      status: "IN_PROGRESS",
      currentQuestionIndex: 0,
      startedAt: new Date(),
      completedAt: null,
      submittedAt: null,
      updatedAt: new Date(),
      responses: [
        {
          id: "ir-2",
          interviewId: "iv-2",
          questionId: "q-2",
          audioUrl: "https://example.com/a.webm",
          audioS3Key: "k",
          audioContentType: "audio/webm",
          audioDuration: 12,
          transcription: null,
          hasTranscription: false,
          transcriptionStatus: "PENDING",
          answeredAt: null,
          updatedAt: new Date(),
        },
      ],
    });

    const out = await getIntakeInterview("u-1", "iv-2");
    expect(out!.responses[0].transcription).toBeNull();
  });

  it("returns null when the interview is missing (no decrypt attempt)", async () => {
    prismaSpies.intakeInterview.findFirst.mockResolvedValue(null);
    const out = await getIntakeInterview("u-1", "missing");
    expect(out).toBeNull();
  });
});

describe("getClientIntakeForReview advisor-note scoping (US-46c)", () => {
  it("scopes the advisorNotes join to the calling advisor's user id when advisorUserId is provided", async () => {
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-scoped",
      userId: "u-scoped",
      status: "SUBMITTED",
      currentQuestionIndex: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      submittedAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "u-scoped",
        name: "Scoped Client",
        emailCiphertext: userEmailCiphertext("scoped@example.com"),
      },
      responses: [],
    });
    (prismaSpies as Record<string, unknown>).intakeApproval = {
      findUnique: vi.fn().mockResolvedValue(null),
    };

    await getClientIntakeForReview("adv-1", "iv-scoped", "advisor-user-7");

    // Inspect the include shape we passed to prisma. The advisorNotes
    // filter MUST scope to the calling advisor's user id — never global.
    const findUniqueSpy = prismaSpies.intakeInterview.findUnique as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> };
    };
    const args = findUniqueSpy.mock.calls
      .map((call) => call[0] as { where?: { id?: string }; include?: unknown })
      .find((arg) => arg.where?.id === "iv-scoped" && arg.include)! as {
      include: {
        responses: {
          include?: { advisorNotes?: { where: { advisorId: string } } };
        };
      };
    };
    expect(args.include.responses.include?.advisorNotes?.where).toEqual({
      advisorId: "advisor-user-7",
    });
  });

  it("omits the advisorNotes join entirely when advisorUserId is not provided (back-compat)", async () => {
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-noscope",
      userId: "u-noscope",
      status: "SUBMITTED",
      currentQuestionIndex: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      submittedAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "u-noscope",
        name: "No-scope Client",
        emailCiphertext: userEmailCiphertext("noscope@example.com"),
      },
      responses: [],
    });
    (prismaSpies as Record<string, unknown>).intakeApproval = {
      findUnique: vi.fn().mockResolvedValue(null),
    };

    await getClientIntakeForReview("adv-1", "iv-noscope");

    const findUniqueSpy = prismaSpies.intakeInterview.findUnique as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> };
    };
    const args = findUniqueSpy.mock.calls
      .map((call) => call[0] as { where?: { id?: string }; include?: unknown })
      .find((arg) => arg.where?.id === "iv-noscope" && arg.include)! as {
      include: {
        responses: { include?: unknown };
      };
    };
    // No include on responses ⇒ no advisor-note join attempted.
    expect(args.include.responses.include).toBeUndefined();
  });

  it("does NOT include the admin-note relation (admins use a separate query)", async () => {
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-noadmin",
      userId: "u-noadmin",
      status: "SUBMITTED",
      currentQuestionIndex: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      submittedAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "u-noadmin",
        name: "Plain Client",
        emailCiphertext: userEmailCiphertext("plain@example.com"),
      },
      responses: [],
    });
    (prismaSpies as Record<string, unknown>).intakeApproval = {
      findUnique: vi.fn().mockResolvedValue(null),
    };

    await getClientIntakeForReview("adv-1", "iv-noadmin", "advisor-user-7");

    const findUniqueSpy = prismaSpies.intakeInterview.findUnique as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> };
    };
    const args = findUniqueSpy.mock.calls
      .map((call) => call[0] as { where?: { id?: string }; include?: unknown })
      .find((arg) => arg.where?.id === "iv-noadmin" && arg.include)! as {
      include: {
        responses: {
          include?: Record<string, unknown>;
        };
      };
    };
    // The advisor query must never pull in `adminNote` — that's the admin
    // channel's view (admin-intake-queries / `IntakeResponseAdminNote`).
    expect(args.include.responses.include?.adminNote).toBeUndefined();
    expect(args.include.responses.include?.adminNotes).toBeUndefined();
  });

  it("returns null (tenant gate) when the interview is missing", async () => {
    prismaSpies.intakeInterview.findUnique.mockResolvedValue(null);

    const out = await getClientIntakeForReview(
      "adv-1",
      "iv-missing",
      "advisor-user-7"
    );
    expect(out).toBeNull();
  });

  it("returns null when the advisor has no active assignment to the intake owner", async () => {
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-unassigned",
      userId: "u-other",
      user: {
        id: "u-other",
        name: "Other Client",
        emailCiphertext: userEmailCiphertext("other@example.com"),
      },
      responses: [],
    });
    prismaSpies.clientAdvisorAssignment.findFirst.mockResolvedValue(null);
    portfolioSpies.findPortfolioAssignmentForClient.mockResolvedValue(null);

    const out = await getClientIntakeForReview(
      "adv-1",
      "iv-unassigned",
      "advisor-user-7",
    );
    expect(out).toBeNull();
  });

  it("reshapes the advisorNotes array → singular `advisorNote` on each response", async () => {
    const noteUpdatedAt = new Date("2026-04-30T12:34:56Z");
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-reshape",
      userId: "u-reshape",
      status: "SUBMITTED",
      currentQuestionIndex: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      submittedAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "u-reshape",
        name: "Reshape Client",
        emailCiphertext: userEmailCiphertext("reshape@example.com"),
      },
      responses: [
        {
          id: "ir-reshape",
          interviewId: "iv-reshape",
          questionId: "q-reshape",
          audioUrl: null,
          audioS3Key: null,
          audioContentType: null,
          audioDuration: null,
          transcription: null,
          hasTranscription: false,
          transcriptionStatus: null,
          answeredAt: new Date(),
          updatedAt: new Date(),
          advisorNotes: [
            {
              id: "n-1",
              advisorId: "advisor-user-7",
              body: "scoped note",
              updatedAt: noteUpdatedAt,
            },
          ],
        },
      ],
    });
    (prismaSpies as Record<string, unknown>).intakeApproval = {
      findUnique: vi.fn().mockResolvedValue(null),
    };

    const out = await getClientIntakeForReview(
      "adv-1",
      "iv-reshape",
      "advisor-user-7"
    );
    expect(out).not.toBeNull();
    const response = out!.interview.responses[0] as unknown as {
      advisorNote: { id: string; body: string; updatedAt: string } | null;
    };
    expect(response.advisorNote).toEqual({
      id: "n-1",
      body: "scoped note",
      updatedAt: noteUpdatedAt.toISOString(),
    });
  });
});

describe("getClientIntakeForReview decrypt mapper", () => {
  it("decrypts response.transcription AND user.email on the way out", async () => {
    const plain = "Family-office governance is currently informal.";
    prismaSpies.intakeInterview.findUnique.mockResolvedValue({
      id: "iv-3",
      userId: "u-2",
      status: "SUBMITTED",
      currentQuestionIndex: 9,
      startedAt: new Date(),
      completedAt: new Date(),
      submittedAt: new Date(),
      updatedAt: new Date(),
      user: {
        id: "u-2",
        name: "Client Two",
        emailCiphertext: userEmailCiphertext("client-two@example.com"),
      },
      responses: [
        {
          id: "ir-3",
          interviewId: "iv-3",
          questionId: "q-3",
          audioUrl: null,
          audioS3Key: null,
          audioContentType: null,
          audioDuration: null,
          transcription: encryptTranscription(plain),
          hasTranscription: true,
          transcriptionStatus: "COMPLETED",
          answeredAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    // Need a separate findUnique mock for the approval — getClientIntakeForReview
    // calls prisma.intakeApproval.findUnique. Add it lazily.
    (prismaSpies as Record<string, unknown>).intakeApproval = {
      findUnique: vi.fn().mockResolvedValue(null),
    };

    const out = await getClientIntakeForReview("adv-1", "iv-3");
    expect(out).not.toBeNull();
    expect(out!.interview.user.email).toBe("client-two@example.com");
    expect(out!.interview.responses[0].transcription).toBe(plain);
  });
});
