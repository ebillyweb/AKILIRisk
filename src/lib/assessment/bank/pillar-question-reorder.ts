import "server-only";

import type { PillarQuestion } from "@prisma/client";
import { PillarCategoryKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { riskAreaIdForPillarCategory } from "./pillar-category-risk-area";
import {
  pillarQuestionInclude,
  sortPillarQuestionRows,
  type PillarQuestionWithHierarchy,
} from "./pillar-question-wire";
import { isPlatformRiskAreaSlug } from "@/lib/methodology/cached-pillar-catalog";

export async function loadSortedPillarQuestionsForRiskArea(
  riskAreaId: string
): Promise<PillarQuestionWithHierarchy[]> {
  if (!(await isPlatformRiskAreaSlug(riskAreaId))) return [];

  const rows = (await prisma.pillarQuestion.findMany({
    where: {
      section: { category: { kind: { not: PillarCategoryKind.INTAKE } } },
    },
    include: pillarQuestionInclude,
  })) as PillarQuestionWithHierarchy[];

  return sortPillarQuestionRows(rows).filter(
    (r) => riskAreaIdForPillarCategory(r.section.category) === riskAreaId
  );
}

type ReorderResult =
  | { ok: true; movedId: string; swappedWithId: string | null }
  | { ok: false; reason: "not_found" | "boundary" | "invalid_area" };

/**
 * Move a pillar question up/down within the flattened risk-area list.
 * Same-section moves swap `displayOrder`. Cross-section moves insert before/after
 * the neighbor by re-homing the row and renumbering the target section.
 */
export async function reorderPillarQuestionInRiskArea(input: {
  riskAreaId: string;
  questionId: string;
  direction: "up" | "down";
}): Promise<ReorderResult> {
  const { riskAreaId, questionId, direction } = input;
  if (!(await isPlatformRiskAreaSlug(riskAreaId))) {
    return { ok: false, reason: "invalid_area" };
  }

  const sorted = await loadSortedPillarQuestionsForRiskArea(riskAreaId);
  const idx = sorted.findIndex((q) => q.id === questionId);
  if (idx < 0) return { ok: false, reason: "not_found" };

  const neighborIdx = direction === "up" ? idx - 1 : idx + 1;
  if (neighborIdx < 0 || neighborIdx >= sorted.length) {
    return { ok: false, reason: "boundary" };
  }

  const current = sorted[idx]!;
  const neighbor = sorted[neighborIdx]!;

  if (current.sectionId === neighbor.sectionId) {
    await prisma.$transaction(async (tx) => {
      const tempOrder = -1;
      await tx.pillarQuestion.update({
        where: { id: current.id },
        data: { displayOrder: tempOrder },
      });
      await tx.pillarQuestion.update({
        where: { id: neighbor.id },
        data: { displayOrder: current.displayOrder },
      });
      await tx.pillarQuestion.update({
        where: { id: current.id },
        data: { displayOrder: neighbor.displayOrder },
      });
    });
    return { ok: true, movedId: current.id, swappedWithId: neighbor.id };
  }

  if (direction === "up") {
    await insertPillarQuestionBefore(current, neighbor);
  } else {
    await insertPillarQuestionAfter(current, neighbor);
  }

  return { ok: true, movedId: current.id, swappedWithId: neighbor.id };
}

async function insertPillarQuestionBefore(
  moving: PillarQuestion,
  anchor: PillarQuestion
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const toShift = await tx.pillarQuestion.findMany({
      where: {
        sectionId: anchor.sectionId,
        displayOrder: { gte: anchor.displayOrder },
      },
      orderBy: { displayOrder: "desc" },
    });

    for (const row of toShift) {
      await tx.pillarQuestion.update({
        where: { id: row.id },
        data: { displayOrder: row.displayOrder + 1 },
      });
    }

    await tx.pillarQuestion.update({
      where: { id: moving.id },
      data: {
        sectionId: anchor.sectionId,
        displayOrder: anchor.displayOrder,
      },
    });

    await compactPillarSectionDisplayOrders(tx, moving.sectionId, moving.id);
  });
}

async function insertPillarQuestionAfter(
  moving: PillarQuestion,
  anchor: PillarQuestion
): Promise<void> {
  const targetOrder = anchor.displayOrder + 1;

  await prisma.$transaction(async (tx) => {
    const toShift = await tx.pillarQuestion.findMany({
      where: {
        sectionId: anchor.sectionId,
        displayOrder: { gte: targetOrder },
      },
      orderBy: { displayOrder: "desc" },
    });

    for (const row of toShift) {
      await tx.pillarQuestion.update({
        where: { id: row.id },
        data: { displayOrder: row.displayOrder + 1 },
      });
    }

    await tx.pillarQuestion.update({
      where: { id: moving.id },
      data: {
        sectionId: anchor.sectionId,
        displayOrder: targetOrder,
      },
    });

    await compactPillarSectionDisplayOrders(tx, moving.sectionId, moving.id);
  });
}

async function compactPillarSectionDisplayOrders(
  tx: Pick<typeof prisma, "pillarQuestion">,
  sectionId: string,
  excludeId: string
): Promise<void> {
  const remaining = await tx.pillarQuestion.findMany({
    where: { sectionId, id: { not: excludeId } },
    orderBy: { displayOrder: "asc" },
  });

  for (let i = 0; i < remaining.length; i++) {
    const row = remaining[i]!;
    if (row.displayOrder !== i) {
      await tx.pillarQuestion.update({
        where: { id: row.id },
        data: { displayOrder: i },
      });
    }
  }
}
