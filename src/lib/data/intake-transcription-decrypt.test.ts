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

const { prismaSpies } = vi.hoisted(() => ({
  prismaSpies: {
    intakeInterview: { findFirst: vi.fn() },
    advisorProfile: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaSpies,
}));

import { getIntakeInterview } from "./intake";
import { getClientIntakeForReview } from "./advisor";
import { encryptTranscription } from "./response-content";
import { userEmailCiphertext } from "@/lib/auth/user-email";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  prismaSpies.intakeInterview.findFirst.mockReset();
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

describe("getClientIntakeForReview decrypt mapper", () => {
  it("decrypts response.transcription AND user.email on the way out", async () => {
    const plain = "Family-office governance is currently informal.";
    prismaSpies.intakeInterview.findFirst.mockResolvedValue({
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
