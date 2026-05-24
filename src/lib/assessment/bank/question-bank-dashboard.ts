import "server-only";

import { prisma } from "@/lib/db";
import type { GovernanceQuestionWire } from "./behaviors";
import { loadGovernanceQuestionWires } from "./load-bank";

export type QuestionBankDashboardRow = GovernanceQuestionWire & {
  isVisible: boolean;
};

export type QuestionBankAreaCounts = {
  total: number;
  visible: number;
};

export async function loadQuestionBankCountsByRiskArea(): Promise<
  Record<string, QuestionBankAreaCounts>
> {
  const allWires = await loadGovernanceQuestionWires({
    onlyVisible: false,
  });

  const result: Record<string, QuestionBankAreaCounts> = {};
  if (allWires.length === 0) return result;

  const questionIds = [...new Set(allWires.map((w) => w.questionId))];
  const pillarRows = await prisma.pillarQuestion.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, isVisible: true },
  });
  const pillarVisibilityById = new Map(pillarRows.map((r) => [r.id, r.isVisible]));

  for (const w of allWires) {
    const area = w.riskAreaId;
    if (area === null) continue;
    if (!result[area]) result[area] = { total: 0, visible: 0 };
    result[area].total += 1;
    if (pillarVisibilityById.get(w.questionId) !== false) {
      result[area].visible += 1;
    }
  }

  return result;
}

export async function loadQuestionBankDashboardRows(
  riskAreaId: string
): Promise<QuestionBankDashboardRow[]> {
  const wires = await loadGovernanceQuestionWires({
    onlyVisible: false,
    riskAreaId,
  });
  if (wires.length === 0) return [];

  const pillarRows = await prisma.pillarQuestion.findMany({
    where: { id: { in: wires.map((w) => w.questionId) } },
    select: { id: true, isVisible: true },
  });
  const pillarVisibilityById = new Map(pillarRows.map((r) => [r.id, r.isVisible]));

  return wires.map((w) => ({
    ...w,
    isVisible: pillarVisibilityById.get(w.questionId) ?? true,
  }));
}
