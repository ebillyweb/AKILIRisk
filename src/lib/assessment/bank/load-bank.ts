import "server-only";

import { PillarCategoryKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { GovernanceQuestionWire } from "./behaviors";
import { wireQuestionsToQuestions } from "./behaviors";
import type { Question } from "@/lib/assessment/types";
import { riskAreaIdForPillarCategory } from "./pillar-category-risk-area";
import {
  assignSortOrderGlobals,
  pillarQuestionInclude,
  pillarQuestionRowToWire,
  sortPillarQuestionRows,
  type PillarQuestionWithHierarchy,
} from "./pillar-question-wire";

/**
 * Load assessment questions from the pillar DDL (`questions` table).
 *
 * No legacy fallback: if the pillar table is unreachable or the query fails,
 * the error propagates to the caller, which is expected to surface a clear
 * "question bank unavailable" error rather than silently return empty data.
 */
export async function loadGovernanceQuestionWires(options: {
  onlyVisible: boolean;
  riskAreaId?: string;
}): Promise<GovernanceQuestionWire[]> {
  const rows = (await prisma.pillarQuestion.findMany({
    where: {
      ...(options.onlyVisible ? { isVisible: true } : {}),
      section: {
        category: { kind: { not: PillarCategoryKind.INTAKE } },
      },
    },
    include: pillarQuestionInclude,
  })) as PillarQuestionWithHierarchy[];

  let sorted = sortPillarQuestionRows(rows);
  if (options.riskAreaId) {
    sorted = sorted.filter(
      (r) => riskAreaIdForPillarCategory(r.section.category) === options.riskAreaId
    );
  }
  return assignSortOrderGlobals(sorted.map(pillarQuestionRowToWire));
}

export async function loadGovernanceQuestionsMerged(options: {
  onlyVisible: boolean;
  riskAreaId?: string;
}): Promise<Question[]> {
  const wires = await loadGovernanceQuestionWires(options);
  return wireQuestionsToQuestions(wires);
}

export async function countVisibleGovernanceQuestions(): Promise<number> {
  return prisma.pillarQuestion.count({
    where: {
      isVisible: true,
      section: { category: { kind: { not: PillarCategoryKind.INTAKE } } },
    },
  });
}
