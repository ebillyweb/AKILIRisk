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
 * Move one question up/down within an already-sorted flat list.
 * Same-section moves swap `displayOrder`. Cross-section moves insert before/after
 * the neighbor by re-homing the row and renumbering the target section.
 *
 * Scope-agnostic: callers pass whatever flattened list defines "adjacent"
 * (a risk area for assessment, the whole intake script for intake).
 */
async function reorderWithinSortedList(
  sorted: PillarQuestionWithHierarchy[],
  questionId: string,
  direction: "up" | "down"
): Promise<ReorderResult> {
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

/**
 * Move a pillar question up/down within the flattened risk-area list.
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
  return reorderWithinSortedList(sorted, questionId, direction);
}

/** All intake-category questions, sorted the same way the live interview reads them. */
export async function loadSortedIntakePillarQuestions(): Promise<
  PillarQuestionWithHierarchy[]
> {
  const rows = (await prisma.pillarQuestion.findMany({
    where: {
      section: { category: { kind: PillarCategoryKind.INTAKE } },
    },
    include: pillarQuestionInclude,
  })) as PillarQuestionWithHierarchy[];

  return sortPillarQuestionRows(rows);
}

/**
 * Move an intake question up/down within the flattened intake script.
 */
export async function reorderIntakePillarQuestion(input: {
  questionId: string;
  direction: "up" | "down";
}): Promise<ReorderResult> {
  const sorted = await loadSortedIntakePillarQuestions();
  return reorderWithinSortedList(sorted, input.questionId, input.direction);
}

/**
 * Place a question at an explicit 0-based position within its own section,
 * shifting siblings to make room. Renumbers the section 0..n-1 in a single
 * transaction using a temporary negative pass so the
 * `@@unique([sectionId, displayOrder])` constraint is never tripped mid-update.
 *
 * This is what makes "set this to order 2" safe from the edit form — a blind
 * write to an already-taken displayOrder would otherwise throw.
 */
export async function repositionPillarQuestionWithinSection(input: {
  questionId: string;
  targetOrder: number;
}): Promise<void> {
  const { questionId, targetOrder } = input;
  const moving = await prisma.pillarQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, sectionId: true },
  });
  if (!moving) throw new Error("Question not found");

  await prisma.$transaction(async (tx) => {
    const rows = await tx.pillarQuestion.findMany({
      where: { sectionId: moving.sectionId },
      orderBy: { displayOrder: "asc" },
      select: { id: true },
    });

    const others = rows.filter((r) => r.id !== questionId).map((r) => r.id);
    const clamped = Math.max(0, Math.min(Math.trunc(targetOrder), others.length));
    const ordered = [
      ...others.slice(0, clamped),
      questionId,
      ...others.slice(clamped),
    ];

    // Phase 1: park every row at a unique negative slot.
    for (let i = 0; i < ordered.length; i++) {
      await tx.pillarQuestion.update({
        where: { id: ordered[i]! },
        data: { displayOrder: -(i + 1) },
      });
    }
    // Phase 2: assign final contiguous 0..n-1 order.
    for (let i = 0; i < ordered.length; i++) {
      await tx.pillarQuestion.update({
        where: { id: ordered[i]! },
        data: { displayOrder: i },
      });
    }
  });
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
