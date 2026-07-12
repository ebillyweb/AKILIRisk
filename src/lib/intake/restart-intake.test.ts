import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assessmentFindFirst: vi.fn(),
  facilitatedSessionFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    assessment: { findFirst: mocks.assessmentFindFirst },
    facilitatedSession: { findFirst: mocks.facilitatedSessionFindFirst },
  },
}));

import {
  getRestartIntakeEligibility,
  restartIntakeBlockedMessage,
} from "@/lib/intake/restart-intake";

describe("getRestartIntakeEligibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assessmentFindFirst.mockResolvedValue(null);
    mocks.facilitatedSessionFindFirst.mockResolvedValue(null);
  });

  it("blocks inactive assignments", async () => {
    const result = await getRestartIntakeEligibility({
      assignmentStatus: "INACTIVE",
      intakeWaived: false,
      clientId: "client-1",
    });

    expect(result).toEqual({ allowed: false, reason: "assignment_inactive" });
    expect(mocks.assessmentFindFirst).not.toHaveBeenCalled();
  });

  it("blocks waived intake", async () => {
    const result = await getRestartIntakeEligibility({
      assignmentStatus: "ACTIVE",
      intakeWaived: true,
      clientId: "client-1",
    });

    expect(result).toEqual({ allowed: false, reason: "intake_waived" });
  });

  it("blocks when assessment has started", async () => {
    mocks.assessmentFindFirst.mockResolvedValue({ id: "asmt-1" });

    const result = await getRestartIntakeEligibility({
      assignmentStatus: "ACTIVE",
      intakeWaived: false,
      clientId: "client-1",
    });

    expect(result).toEqual({ allowed: false, reason: "assessment_started" });
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

  it("allows restart for active intake-only clients", async () => {
    const result = await getRestartIntakeEligibility({
      assignmentStatus: "ACTIVE",
      intakeWaived: false,
      clientId: "client-1",
    });

    expect(result).toEqual({ allowed: true });
  });
});

describe("restartIntakeBlockedMessage", () => {
  it("returns advisor-facing copy for each block reason", () => {
    expect(restartIntakeBlockedMessage("assessment_started")).toContain("assessment");
    expect(restartIntakeBlockedMessage("intake_waived")).toContain("waiver");
  });
});
