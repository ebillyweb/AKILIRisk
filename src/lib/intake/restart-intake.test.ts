import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  facilitatedSessionFindFirst: vi.fn(),
  $transaction: vi.fn(),
  interviewUpdateMany: vi.fn(),
  interviewCreate: vi.fn(),
  assessmentUpdateMany: vi.fn(),
  assignmentUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    facilitatedSession: { findFirst: mocks.facilitatedSessionFindFirst },
    $transaction: mocks.$transaction,
  },
}));

import {
  getRestartIntakeEligibility,
  restartClientIntakeForUser,
  restartIntakeBlockedMessage,
} from "@/lib/intake/restart-intake";

describe("getRestartIntakeEligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.facilitatedSessionFindFirst.mockResolvedValue(null);
  });

  it("blocks inactive assignments", async () => {
    const result = await getRestartIntakeEligibility({
      assignmentStatus: "INACTIVE",
      intakeWaived: false,
      clientId: "client-1",
    });

    expect(result).toEqual({ allowed: false, reason: "assignment_inactive" });
    expect(mocks.facilitatedSessionFindFirst).not.toHaveBeenCalled();
  });

  it("blocks waived intake", async () => {
    const result = await getRestartIntakeEligibility({
      assignmentStatus: "ACTIVE",
      intakeWaived: true,
      clientId: "client-1",
    });

    expect(result).toEqual({ allowed: false, reason: "intake_waived" });
  });

  it("allows restart even after an assessment has started", async () => {
    // A started/completed assessment no longer blocks — restart archives it.
    const result = await getRestartIntakeEligibility({
      assignmentStatus: "ACTIVE",
      intakeWaived: false,
      clientId: "client-1",
    });

    expect(result).toEqual({ allowed: true });
  });

  it("blocks when a live session is open", async () => {
    mocks.facilitatedSessionFindFirst.mockResolvedValue({ id: "sess-1" });

    const result = await getRestartIntakeEligibility({
      assignmentStatus: "ACTIVE",
      intakeWaived: false,
      clientId: "client-1",
    });

    expect(result).toEqual({ allowed: false, reason: "facilitated_session_open" });
  });
});

describe("restartClientIntakeForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.interviewUpdateMany.mockResolvedValue({ count: 1 });
    mocks.assessmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.assignmentUpdateMany.mockResolvedValue({ count: 1 });
    mocks.interviewCreate.mockResolvedValue({ id: "new-interview", status: "NOT_STARTED" });
    mocks.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        intakeInterview: {
          updateMany: mocks.interviewUpdateMany,
          create: mocks.interviewCreate,
        },
        assessment: { updateMany: mocks.assessmentUpdateMany },
        clientAdvisorAssignment: { updateMany: mocks.assignmentUpdateMany },
      }),
    );
  });

  it("archives interviews + assessments, clears scope, and creates a fresh interview", async () => {
    const result = await restartClientIntakeForUser("client-1");

    // Old interviews archived (soft, via archivedAt).
    expect(mocks.interviewUpdateMany).toHaveBeenCalledWith({
      where: { userId: "client-1", archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    });
    // Started/completed assessments archived.
    expect(mocks.assessmentUpdateMany).toHaveBeenCalledWith({
      where: { userId: "client-1", status: { in: ["IN_PROGRESS", "COMPLETED"] } },
      data: { status: "ARCHIVED" },
    });
    // Engagement scope cleared so the assessment re-locks until re-approval.
    expect(mocks.assignmentUpdateMany).toHaveBeenCalledWith({
      where: { clientId: "client-1", status: "ACTIVE" },
      data: { includedPillars: [], focusAreas: [] },
    });
    // Fresh interview created at the start.
    expect(mocks.interviewCreate).toHaveBeenCalledWith({
      data: { userId: "client-1", status: "NOT_STARTED", currentQuestionIndex: 0 },
    });

    expect(result).toEqual({
      interview: { id: "new-interview", status: "NOT_STARTED" },
      archivedCount: 1,
      archivedAssessmentCount: 1,
    });
  });
});

describe("restartIntakeBlockedMessage", () => {
  it("returns advisor-facing copy for each block reason", () => {
    expect(restartIntakeBlockedMessage("facilitated_session_open")).toContain("live session");
    expect(restartIntakeBlockedMessage("intake_waived")).toContain("waiver");
  });
});
