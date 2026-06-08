#!/usr/bin/env npx tsx
/**
 * Insert document-upload sub-questions for every scored_0_3 parent whose
 * 3rd/4th tier references documentation, then renumber display_order per section.
 *
 * Usage: npx tsx scripts/apply-documented-tier-upload-subs.ts
 *        DRY_RUN=1 npx tsx scripts/apply-documented-tier-upload-subs.ts
 */
import "./load-repo-env";
import {
  DOCUMENT_UPLOAD_ACTIONS,
  DOCUMENT_UPLOAD_PROMPT,
  DOCUMENT_UPLOAD_WHY,
  scored0_3TierImpliesDocumentation,
  suggestDocumentUploadSubNumber,
} from "../src/lib/assessment/document-upload-sub";
import { sortPillarQuestionRows } from "../src/lib/assessment/bank/pillar-question-wire";
import { isDocumentUploadFillableQuestionText } from "../src/lib/assessment/question-upload";
import { disconnectPrismaScript, prisma } from "./lib/prisma-for-scripts";

const dryRun =
  process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function parentHasDocumentUploadSub(
  sectionId: string,
  parentNumber: string,
  siblings: { sectionId: string; questionNumber: string | null; questionText: string }[]
): boolean {
  return siblings.some(
    (row) =>
      row.sectionId === sectionId &&
      row.questionNumber &&
      row.questionNumber !== parentNumber &&
      row.questionNumber.startsWith(parentNumber) &&
      isDocumentUploadFillableQuestionText(row.questionText)
  );
}

async function main(): Promise<void> {
  const parents = await prisma.pillarQuestion.findMany({
    where: { answerType: "scored_0_3", isSubQuestion: false },
    select: {
      id: true,
      sectionId: true,
      questionNumber: true,
      answerType: true,
      answer2: true,
      answer3: true,
      displayOrder: true,
    },
    orderBy: [{ sectionId: "asc" }, { displayOrder: "asc" }],
  });

  const allInSections = await prisma.pillarQuestion.findMany({
    select: { sectionId: true, questionNumber: true, questionText: true },
  });

  const numsBySection = new Map<string, string[]>();
  for (const row of allInSections) {
    if (!row.questionNumber) continue;
    const list = numsBySection.get(row.sectionId) ?? [];
    list.push(row.questionNumber);
    numsBySection.set(row.sectionId, list);
  }

  const toInsert = parents.filter((p) => {
    if (!p.questionNumber) return false;
    if (
      !scored0_3TierImpliesDocumentation({
        answerType: p.answerType,
        answer2: p.answer2,
        answer3: p.answer3,
      })
    ) {
      return false;
    }
    return !parentHasDocumentUploadSub(p.sectionId, p.questionNumber, allInSections);
  });

  if (toInsert.length === 0) {
    console.log("No missing document-upload subs.");
    return;
  }

  console.log(
    `${dryRun ? "[DRY RUN] Would insert" : "Inserting"} ${toInsert.length} document-upload sub(s):`
  );
  for (const p of toInsert) {
    const subNumber = suggestDocumentUploadSubNumber(
      p.questionNumber!,
      numsBySection.get(p.sectionId) ?? []
    );
    console.log(`  ${p.sectionId} ${p.questionNumber} → ${subNumber}`);
  }

  if (dryRun) return;

  const affectedSections = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const p of toInsert) {
      const subNumber = suggestDocumentUploadSubNumber(
        p.questionNumber!,
        numsBySection.get(p.sectionId) ?? []
      );
      await tx.pillarQuestion.create({
        data: {
          sectionId: p.sectionId,
          questionNumber: subNumber,
          questionText: DOCUMENT_UPLOAD_PROMPT,
          answerType: "fillable",
          whyThisMatters: DOCUMENT_UPLOAD_WHY,
          recommendedActions: DOCUMENT_UPLOAD_ACTIONS,
          isSubQuestion: true,
          displayOrder: p.displayOrder + 1,
        },
      });
      const list = numsBySection.get(p.sectionId) ?? [];
      list.push(subNumber);
      numsBySection.set(p.sectionId, list);
      affectedSections.add(p.sectionId);
    }

    for (const sectionId of affectedSections) {
      const rows = await tx.pillarQuestion.findMany({
        where: { sectionId },
        include: {
          section: { include: { category: true } },
        },
      });
      const sorted = sortPillarQuestionRows(rows);
      for (let i = 0; i < sorted.length; i++) {
        const row = sorted[i]!;
        const nextOrder = i + 1;
        if (row.displayOrder !== nextOrder) {
          await tx.pillarQuestion.update({
            where: { id: row.id },
            data: { displayOrder: nextOrder },
          });
        }
      }
    }
  });

  console.log(`Done. Renumbered ${affectedSections.size} section(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrismaScript();
  });
