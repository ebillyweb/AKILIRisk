import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaSpies, writeAuditSpy, requireAdminRoleSpy, redirectSpy, reorderSpy } = vi.hoisted(
  () => ({
    prismaSpies: {
      pillarQuestion: {
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(),
        aggregate: vi.fn(),
      },
      pillarSection: {
        findUnique: vi.fn(),
      },
      pillar: { findMany: vi.fn().mockResolvedValue([]) },
    },
    writeAuditSpy: vi.fn().mockResolvedValue(undefined),
    requireAdminRoleSpy: vi.fn().mockResolvedValue({
      userId: "admin-1",
      email: "admin@example.com",
      role: "ADMIN",
    }),
    redirectSpy: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    }),
    reorderSpy: vi.fn(),
  })
);

vi.mock("@/lib/db", () => ({ prisma: prismaSpies }));
vi.mock("@/lib/audit/audit-log", async () => {
  const actual = await vi.importActual<typeof import("@/lib/audit/audit-log")>(
    "@/lib/audit/audit-log"
  );
  return { ...actual, writeAudit: (...args: unknown[]) => writeAuditSpy(...args) };
});
vi.mock("@/lib/admin/auth", () => ({
  requireAdminRole: () => requireAdminRoleSpy(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectSpy(url),
}));
vi.mock("@/lib/assessment/bank/pillar-question-reorder", () => ({
  reorderPillarQuestionInRiskArea: (...args: unknown[]) => reorderSpy(...args),
}));
vi.mock("@/lib/assessment/bank/question-bank-source", () => ({
  isPillarQuestionBankActive: vi.fn().mockResolvedValue(true),
}));

import {
  updatePillarQuestionVisibility,
  deletePillarQuestion,
  movePillarQuestionOrder,
} from "./admin-question-bank-actions";
import { AUDIT_ACTIONS } from "@/lib/audit/audit-log";

const GOVERNANCE_CATEGORY = {
  id: "cat-gov",
  code: "1_governance",
  kind: "ASSESSMENT" as const,
};

const QUESTION_ROW = {
  id: "00000000-0000-0000-0002-000000000001",
  questionText: "Sample?",
  isVisible: true,
  displayOrder: 1,
  sectionId: "00000000-0000-0000-0002-000000000005",
  section: { category: GOVERNANCE_CATEGORY },
};

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminRoleSpy.mockResolvedValue({
    userId: "admin-1",
    email: "admin@example.com",
    role: "ADMIN",
  });
});

describe("updatePillarQuestionVisibility", () => {
  it("writes audit and redirects when toggling visibility", async () => {
    prismaSpies.pillarQuestion.findUnique.mockResolvedValue(QUESTION_ROW);
    prismaSpies.pillarQuestion.update.mockResolvedValue({});

    await expect(
      updatePillarQuestionVisibility(
        form({
          questionId: QUESTION_ROW.id,
          riskAreaId: "governance",
          isVisible: "false",
        })
      )
    ).rejects.toThrow("REDIRECT:/admin/assessment/questions/governance?saved=1");

    expect(prismaSpies.pillarQuestion.update).toHaveBeenCalledWith({
      where: { id: QUESTION_ROW.id },
      data: { isVisible: false },
    });
    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.PILLAR_QUESTION_VISIBILITY_TOGGLE,
        entityId: QUESTION_ROW.id,
        beforeData: { isVisible: true },
        afterData: { isVisible: false },
      })
    );
  });

  it("accepts Belvedere-style question ids (non–RFC-4122)", async () => {
    prismaSpies.pillarQuestion.findUnique.mockResolvedValue(QUESTION_ROW);
    prismaSpies.pillarQuestion.update.mockResolvedValue({});

    await expect(
      updatePillarQuestionVisibility(
        form({
          questionId: "00000000-0000-0000-0002-000000000001",
          riskAreaId: "governance",
          isVisible: "true",
        })
      )
    ).rejects.toThrow(/REDIRECT:/);

    expect(writeAuditSpy).toHaveBeenCalled();
  });

  it("does not write audit when the question is outside the risk area", async () => {
    prismaSpies.pillarQuestion.findUnique.mockResolvedValue({
      ...QUESTION_ROW,
      section: { category: { ...GOVERNANCE_CATEGORY, code: "2_cybersecurity" } },
    });

    await expect(
      updatePillarQuestionVisibility(
        form({
          questionId: QUESTION_ROW.id,
          riskAreaId: "governance",
          isVisible: "false",
        })
      )
    ).rejects.toThrow("REDIRECT:/admin/assessment/questions/governance?saved=1");

    expect(writeAuditSpy).not.toHaveBeenCalled();
    expect(prismaSpies.pillarQuestion.update).not.toHaveBeenCalled();
  });
});

describe("deletePillarQuestion", () => {
  it("writes audit before redirecting to the area list", async () => {
    prismaSpies.pillarQuestion.findUnique.mockResolvedValue(QUESTION_ROW);
    prismaSpies.pillarQuestion.delete.mockResolvedValue({});

    await expect(
      deletePillarQuestion(
        form({
          questionId: QUESTION_ROW.id,
          riskAreaId: "governance",
        })
      )
    ).rejects.toThrow("REDIRECT:/admin/assessment/questions/governance");

    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.PILLAR_QUESTION_DELETE,
        entityId: QUESTION_ROW.id,
        afterData: null,
      })
    );
  });
});

describe("movePillarQuestionOrder", () => {
  it("writes reorder audit when the move succeeds", async () => {
    prismaSpies.pillarQuestion.findUnique
      .mockResolvedValueOnce(QUESTION_ROW)
      .mockResolvedValueOnce({ displayOrder: 0, sectionId: QUESTION_ROW.sectionId });
    reorderSpy.mockResolvedValue({
      ok: true,
      movedId: QUESTION_ROW.id,
      swappedWithId: "other-id",
    });

    await expect(
      movePillarQuestionOrder(
        form({
          questionId: QUESTION_ROW.id,
          riskAreaId: "governance",
          direction: "up",
        })
      )
    ).rejects.toThrow("REDIRECT:/admin/assessment/questions/governance?saved=1");

    expect(writeAuditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AUDIT_ACTIONS.PILLAR_QUESTION_REORDER,
        metadata: expect.objectContaining({ direction: "up", riskAreaId: "governance" }),
      })
    );
  });

  it("skips audit when reorder hits a boundary", async () => {
    prismaSpies.pillarQuestion.findUnique.mockResolvedValue(QUESTION_ROW);
    reorderSpy.mockResolvedValue({ ok: false, reason: "boundary" });

    await expect(
      movePillarQuestionOrder(
        form({
          questionId: QUESTION_ROW.id,
          riskAreaId: "governance",
          direction: "up",
        })
      )
    ).rejects.toThrow("REDIRECT:/admin/assessment/questions/governance?saved=1");

    expect(writeAuditSpy).not.toHaveBeenCalled();
  });
});
