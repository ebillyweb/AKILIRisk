import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const findFirst = vi.fn();
const create = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { syncMissingPlatformAssessmentQuestions } from "./clone-advisor-defaults";

function platformRow(id: string) {
  return {
    id,
    displayOrder: 1,
    questionNumber: "G1",
    questionText: "Q",
    answerType: "scored_0_3",
    answer0: "a",
    answer1: "b",
    answer2: "c",
    answer3: "d",
    whyThisMatters: null,
    recommendedActions: null,
    isVisible: true,
    isKeyRiskIndicator: false,
    relatedPillarIds: [],
    scoreMap: { "0": 0, "1": 1, "2": 2, "3": 3 },
    section: {
      code: "gov",
      displayOrder: 1,
      category: {
        code: "1_governance",
        kind: "ASSESSMENT",
        displayOrder: 1,
      },
    },
  };
}

describe("syncMissingPlatformAssessmentQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips platform rows that already exist under any source kind", async () => {
    const platformId = "11111111-1111-1111-1111-111111111111";
    const tx = {
      advisorPillarQuestion: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "existing-1",
            platformSourceId: platformId,
            pillarId: "pillar-1",
            questionNumber: "G1",
          },
        ]),
        findFirst,
        create,
        update: vi.fn(),
      },
      pillarQuestion: {
        findMany: vi.fn().mockResolvedValue([platformRow(platformId)]),
      },
    };

    const added = await syncMissingPlatformAssessmentQuestions(
      tx as never,
      "advisor-1",
      new Map([["governance", "pillar-1"]]),
    );

    expect(added).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it("swallows P2002 races when creating a missing platform clone", async () => {
    findFirst.mockResolvedValue(null);
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "0",
      }),
    );

    const platformId = "22222222-2222-2222-2222-222222222222";
    const tx = {
      advisorPillarQuestion: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst,
        create,
        update: vi.fn(),
      },
      pillarQuestion: {
        findMany: vi.fn().mockResolvedValue([platformRow(platformId)]),
      },
    };

    const added = await syncMissingPlatformAssessmentQuestions(
      tx as never,
      "advisor-1",
      new Map([["governance", "pillar-1"]]),
    );

    expect(added).toBe(0);
    expect(create).toHaveBeenCalled();
  });
});
