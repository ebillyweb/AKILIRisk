import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    pillarQuestion: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { isPillarQuestionBankActive } from "./question-bank-source";

describe("question-bank-source", () => {
  beforeEach(() => {
    vi.mocked(prisma.pillarQuestion.count).mockReset();
  });

  it("returns false when pillar table has no scored questions", async () => {
    vi.mocked(prisma.pillarQuestion.count).mockResolvedValue(0);
    await expect(isPillarQuestionBankActive()).resolves.toBe(false);
  });

  it("returns true when scored pillar rows exist", async () => {
    vi.mocked(prisma.pillarQuestion.count).mockResolvedValue(12);
    await expect(isPillarQuestionBankActive()).resolves.toBe(true);
  });
});
