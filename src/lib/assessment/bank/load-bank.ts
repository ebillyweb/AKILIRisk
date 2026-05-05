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
import { prismaRowToWire } from "./row-wire";

export { prismaRowToWire } from "./row-wire";

/**
 * BRD-source pillar DDL tables (`categories` / `sections` / `questions`) are the source of truth
 * when they contain any rows. Set `USE_PILLAR_QUESTION_BANK=0` to force `AssessmentBankQuestion` only.
 */
async function loadGovernanceQuestionWiresFromPillar(options: {
  riskAreaId?: string;
  onlyVisible?: boolean;
}): Promise<GovernanceQuestionWire[] | null> {
  if (process.env.USE_PILLAR_QUESTION_BANK?.trim() === "0") {
    return null;
  }
  try {
    const n = await prisma.pillarQuestion.count();
    if (n === 0) return null;

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
    const wires = assignSortOrderGlobals(sorted.map(pillarQuestionRowToWire));
    return wires;
  } catch (e) {
    console.warn("[load-bank] Pillar question bank unavailable, using AssessmentBankQuestion:", e);
    return null;
  }
}

/**
 * Loads assessment question wires for all pillars (name is historical). Resolution: when
 * `questions` has rows and `USE_PILLAR_QUESTION_BANK` is not `0`, reads pillar DDL; otherwise
 * `AssessmentBankQuestion`.
 */
export async function loadGovernanceQuestionWires(options: {
  onlyVisible: boolean;
  riskAreaId?: string;
}): Promise<GovernanceQuestionWire[]> {
  const fromPillar = await loadGovernanceQuestionWiresFromPillar({
    riskAreaId: options.riskAreaId,
    onlyVisible: options.onlyVisible,
  });
  // Non-null means pillar bank is active (may be an empty list when onlyVisible filters all out).
  if (fromPillar !== null) {
    return fromPillar;
  }

  const rows = await prisma.assessmentBankQuestion.findMany({
    where: {
      ...(options.onlyVisible ? { isVisible: true } : {}),
      ...(options.riskAreaId ? { riskAreaId: options.riskAreaId } : {}),
    },
    orderBy: { sortOrderGlobal: "asc" },
  });
  return rows.map(prismaRowToWire);
}

export async function loadGovernanceQuestionsMerged(options: {
  onlyVisible: boolean;
  riskAreaId?: string;
}): Promise<Question[]> {
  const wires = await loadGovernanceQuestionWires(options);
  return wireQuestionsToQuestions(wires);
}

export async function countVisibleGovernanceQuestions(): Promise<number> {
  if (process.env.USE_PILLAR_QUESTION_BANK?.trim() === "0") {
    return prisma.assessmentBankQuestion.count({ where: { isVisible: true } });
  }
  const pillarTotal = await prisma.pillarQuestion.count();
  if (pillarTotal > 0) {
    return prisma.pillarQuestion.count({
      where: {
        isVisible: true,
        section: { category: { kind: { not: PillarCategoryKind.INTAKE } } },
      },
    });
  }
  return prisma.assessmentBankQuestion.count({ where: { isVisible: true } });
}
