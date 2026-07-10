/**
 * Idempotent seed for assessment questions on the four v3.0 pillars.
 * Usage: npm run seed:new-pillar-questions
 * Then backfill advisors: FORCE=1 npm run seed:advisor-defaults
 */
import "./load-repo-env";
import { PillarCategoryKind, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import {
  NEW_PILLAR_ASSESSMENT_STARTERS,
  SCORED_0_3,
} from "../src/lib/methodology/new-pillar-assessment-starter";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url?.trim()) {
    throw new Error("DATABASE_URL is missing");
  }

  const pool = new Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    let categoriesUpserted = 0;
    let questionsCreated = 0;
    let questionsSkipped = 0;
    let questionsUpdated = 0;

    for (const starter of NEW_PILLAR_ASSESSMENT_STARTERS) {
      const category = await prisma.pillarCategory.upsert({
        where: { code: starter.categoryCode },
        create: {
          code: starter.categoryCode,
          name: starter.categoryName,
          sheetName: starter.sheetName,
          displayOrder: starter.displayOrder,
          kind: PillarCategoryKind.ASSESSMENT,
        },
        update: {
          name: starter.categoryName,
          sheetName: starter.sheetName,
          displayOrder: starter.displayOrder,
          kind: PillarCategoryKind.ASSESSMENT,
        },
      });
      categoriesUpserted++;

      const section = await prisma.pillarSection.upsert({
        where: {
          categoryId_code: {
            categoryId: category.id,
            code: starter.sectionCode,
          },
        },
        create: {
          categoryId: category.id,
          code: starter.sectionCode,
          name: starter.sectionName,
          displayOrder: 0,
        },
        update: {
          name: starter.sectionName,
        },
      });

      for (let i = 0; i < starter.questions.length; i++) {
        const q = starter.questions[i];
        const existing = await prisma.pillarQuestion.findFirst({
          where: {
            sectionId: section.id,
            questionNumber: q.questionNumber,
          },
        });
        const answers = q.answers ?? [];
        if (existing) {
          // The starter is the source of truth for these platform pillars, so
          // re-seeding syncs content onto existing rows (keyed by section +
          // questionNumber). This also lets the slot-10 bank be repurposed
          // from the former Behavioral Resilience questions to the current
          // AI & Emerging Tech Risk questions in place, 1:1, without orphans.
          await prisma.pillarQuestion.update({
            where: { id: existing.id },
            data: {
              questionText: q.questionText,
              whyThisMatters: q.whyThisMatters,
              recommendedActions: q.recommendedActions,
              answer0: answers[0] ?? null,
              answer1: answers[1] ?? null,
              answer2: answers[2] ?? null,
              answer3: answers[3] ?? null,
              displayOrder: i,
            },
          });
          questionsUpdated++;
          continue;
        }

        await prisma.pillarQuestion.create({
          data: {
            sectionId: section.id,
            questionNumber: q.questionNumber,
            questionText: q.questionText,
            answerType: SCORED_0_3.answerType,
            whyThisMatters: q.whyThisMatters,
            recommendedActions: q.recommendedActions,
            answer0: answers[0] ?? null,
            answer1: answers[1] ?? null,
            answer2: answers[2] ?? null,
            answer3: answers[3] ?? null,
            displayOrder: i,
            isVisible: true,
          },
        });
        questionsCreated++;
      }
    }

    console.log(
      `seed:new-pillar-questions complete — categories ${categoriesUpserted}, created ${questionsCreated}, updated ${questionsUpdated}, skipped ${questionsSkipped}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
