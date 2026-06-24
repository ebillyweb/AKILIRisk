import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSessionFindUnique = vi.fn();
const mockSessionFindMany = vi.fn();
const mockSessionUpdate = vi.fn();
const mockSessionUpdateMany = vi.fn();
const mockAssessmentFindUnique = vi.fn();
const mockAssessmentFindMany = vi.fn();

vi.mock("@/lib/facilitated/session-access", () => ({
  getFacilitatedSessionForAdvisor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    facilitatedSession: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
      findMany: (...args: unknown[]) => mockSessionFindMany(...args),
      update: (...args: unknown[]) => mockSessionUpdate(...args),
      updateMany: (...args: unknown[]) => mockSessionUpdateMany(...args),
    },
    assessment: {
      findUnique: (...args: unknown[]) => mockAssessmentFindUnique(...args),
      findMany: (...args: unknown[]) => mockAssessmentFindMany(...args),
    },
  },
}));

import {
  markFacilitatedSessionPreviewIfComplete,
  reconcileMislabeledFacilitatedPreviewSessions,
} from "@/lib/facilitated/assessment-access";

describe("markFacilitatedSessionPreviewIfComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not promote when assessment is in progress even if deliverable phase is PREVIEW", async () => {
    mockSessionFindUnique.mockResolvedValue({
      id: "sess-1",
      status: "ASSESSMENT",
      assessmentId: "asmt-1",
    });
    mockAssessmentFindUnique.mockResolvedValue({
      status: "IN_PROGRESS",
    });

    await markFacilitatedSessionPreviewIfComplete("sess-1");

    expect(mockSessionUpdate).not.toHaveBeenCalled();
  });

  it("promotes to PREVIEW only when assessment is COMPLETED", async () => {
    mockSessionFindUnique.mockResolvedValue({
      id: "sess-1",
      status: "ASSESSMENT",
      assessmentId: "asmt-1",
    });
    mockAssessmentFindUnique.mockResolvedValue({
      status: "COMPLETED",
    });
    mockSessionUpdate.mockResolvedValue({});

    await markFacilitatedSessionPreviewIfComplete("sess-1");

    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { status: "PREVIEW" },
    });
  });
});

describe("reconcileMislabeledFacilitatedPreviewSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reverts PREVIEW sessions whose assessment is still in progress", async () => {
    mockSessionFindMany.mockResolvedValue([
      { id: "sess-1", assessmentId: "asmt-1" },
      { id: "sess-2", assessmentId: "asmt-2" },
    ]);
    mockAssessmentFindMany.mockResolvedValue([
      { id: "asmt-1", status: "IN_PROGRESS" },
      { id: "asmt-2", status: "COMPLETED" },
    ]);
    mockSessionUpdateMany.mockResolvedValue({ count: 1 });

    await reconcileMislabeledFacilitatedPreviewSessions({
      advisorProfileId: "adv-1",
    });

    expect(mockSessionUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["sess-1"] } },
      data: { status: "ASSESSMENT" },
    });
  });
});
