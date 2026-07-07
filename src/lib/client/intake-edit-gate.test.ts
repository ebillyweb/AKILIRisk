import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    assessment: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: prismaMock,
}));

import {
  assertClientIntakeAnswersEditable,
  hasClientAssessmentStarted,
} from "@/lib/client/intake-edit-gate";

describe("hasClientAssessmentStarted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when an in-progress assessment exists", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue({ id: "a1" });
    await expect(hasClientAssessmentStarted("client-1")).resolves.toBe(true);
  });

  it("returns false when no assessment has started", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue(null);
    await expect(hasClientAssessmentStarted("client-1")).resolves.toBe(false);
  });
});

describe("assertClientIntakeAnswersEditable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks edits after assessment has started", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue({ id: "a1" });
    await expect(assertClientIntakeAnswersEditable("client-1")).resolves.toEqual({
      ok: false,
      error:
        "Intake answers cannot be changed after your assessment has started.",
    });
  });

  it("allows edits before assessment starts", async () => {
    prismaMock.assessment.findFirst.mockResolvedValue(null);
    await expect(assertClientIntakeAnswersEditable("client-1")).resolves.toEqual({
      ok: true,
    });
  });
});
