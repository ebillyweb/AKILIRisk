#!/usr/bin/env npx tsx
/**
 * Export pillar question copy to CSV for grammar / style review.
 *
 * Usage:
 *   npm run export:question-copy
 *   npm run export:question-copy -- --out scripts/copy/my-review.csv
 *   npm run export:question-copy -- --from-seed   # no DATABASE_URL required
 */
import "./load-repo-env";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import {
  QUESTION_COPY_CSV_COLUMNS,
  type QuestionCopyRow,
  questionCopyKey,
  serializeQuestionCopyCsv,
} from "../src/lib/question-copy/csv";
import { extractQuestionSeedTuples } from "../src/lib/question-copy/seed-sql";
import { disconnectPrismaScript, prisma } from "./lib/prisma-for-scripts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = resolve(repoRoot, "scripts/copy/question-bank-copy.csv");
const DEFAULT_SEED = resolve(repoRoot, "scripts/sql/belvedere-pillar-ddl-seed.sql");

function parseArgs(argv: string[]) {
  let out = process.env.QUESTION_COPY_EXPORT_PATH?.trim() || DEFAULT_OUT;
  let fromSeed = false;
  let seedPath = process.env.QUESTION_COPY_SEED_PATH?.trim() || DEFAULT_SEED;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--from-seed") {
      fromSeed = true;
    } else if (arg === "--out" && argv[i + 1]) {
      out = resolve(process.cwd(), argv[++i]!);
    } else if (arg === "--seed" && argv[i + 1]) {
      seedPath = resolve(process.cwd(), argv[++i]!);
    }
  }

  return { out, fromSeed, seedPath };
}

function rowFromSeedValues(input: {
  sectionId: string;
  categoryCode: string;
  categoryName: string;
  sectionCode: string;
  questionNumber: string;
  answerType: string;
  questionText: string;
  answer0: string | null;
  answer1: string | null;
  answer2: string | null;
  answer3: string | null;
  whyThisMatters: string | null;
  recommendedActions: string | null;
}): QuestionCopyRow {
  return {
    section_id: input.sectionId,
    category_code: input.categoryCode,
    category_name: input.categoryName,
    section_code: input.sectionCode,
    question_number: input.questionNumber,
    answer_type: input.answerType,
    question_text: input.questionText,
    answer_0: input.answer0 ?? "",
    answer_1: input.answer1 ?? "",
    answer_2: input.answer2 ?? "",
    answer_3: input.answer3 ?? "",
    why_this_matters: input.whyThisMatters ?? "",
    recommended_actions: input.recommendedActions ?? "",
  };
}

async function exportFromDatabase(): Promise<QuestionCopyRow[]> {
  const rows = await prisma.pillarQuestion.findMany({
    include: {
      section: {
        include: { category: true },
      },
    },
    orderBy: [
      { section: { category: { displayOrder: "asc" } } },
      { section: { displayOrder: "asc" } },
      { displayOrder: "asc" },
      { questionNumber: "asc" },
    ],
  });

  return rows.map((row) =>
    rowFromSeedValues({
      sectionId: row.sectionId,
      categoryCode: row.section.category.code,
      categoryName: row.section.category.name,
      sectionCode: row.section.code,
      questionNumber: row.questionNumber ?? "",
      answerType: row.answerType,
      questionText: row.questionText,
      answer0: row.answer0,
      answer1: row.answer1,
      answer2: row.answer2,
      answer3: row.answer3,
      whyThisMatters: row.whyThisMatters,
      recommendedActions: row.recommendedActions,
    })
  );
}

async function exportFromSeed(seedPath: string): Promise<QuestionCopyRow[]> {
  const sql = readFileSync(seedPath, "utf8");
  const tuples = extractQuestionSeedTuples(sql);

  const sections = await prisma.pillarSection.findMany({
    include: { category: true },
  });
  const sectionMeta = new Map(
    sections.map((section) => [
      section.id,
      {
        categoryCode: section.category.code,
        categoryName: section.category.name,
        sectionCode: section.code,
      },
    ])
  );

  return tuples
    .map((tuple) => {
      const meta = sectionMeta.get(tuple.values.sectionId);
      if (!meta) return null;
      return rowFromSeedValues({
        sectionId: tuple.values.sectionId,
        categoryCode: meta.categoryCode,
        categoryName: meta.categoryName,
        sectionCode: meta.sectionCode,
        questionNumber: tuple.values.questionNumber,
        answerType: tuple.values.answerType,
        questionText: tuple.values.questionText,
        answer0: tuple.values.answer0,
        answer1: tuple.values.answer1,
        answer2: tuple.values.answer2,
        answer3: tuple.values.answer3,
        whyThisMatters: tuple.values.whyThisMatters,
        recommendedActions: tuple.values.recommendedActions,
      });
    })
    .filter((row): row is QuestionCopyRow => row !== null);
}

async function exportFromSeedOnly(seedPath: string): Promise<QuestionCopyRow[]> {
  const sql = readFileSync(seedPath, "utf8");
  const tuples = extractQuestionSeedTuples(sql);

  const sectionIds = [...new Set(tuples.map((tuple) => tuple.values.sectionId))];
  const sectionCodeById = new Map<string, string>();
  for (const id of sectionIds) {
    const short = id.split("-").pop() ?? id;
    sectionCodeById.set(id, short);
  }

  return tuples.map((tuple) =>
    rowFromSeedValues({
      sectionId: tuple.values.sectionId,
      categoryCode: tuple.values.sectionId.split("-")[2] ?? "",
      categoryName: "",
      sectionCode: sectionCodeById.get(tuple.values.sectionId) ?? "",
      questionNumber: tuple.values.questionNumber,
      answerType: tuple.values.answerType,
      questionText: tuple.values.questionText,
      answer0: tuple.values.answer0,
      answer1: tuple.values.answer1,
      answer2: tuple.values.answer2,
      answer3: tuple.values.answer3,
      whyThisMatters: tuple.values.whyThisMatters,
      recommendedActions: tuple.values.recommendedActions,
    })
  );
}

async function main(): Promise<void> {
  const { out, fromSeed, seedPath } = parseArgs(process.argv.slice(2));

  let rows: QuestionCopyRow[];
  if (fromSeed) {
    rows = await exportFromSeedOnly(seedPath);
    console.log(`Exported ${rows.length} question(s) from seed SQL: ${seedPath}`);
  } else {
    rows = await exportFromDatabase();
    if (rows.length === 0) {
      console.warn("Database question bank is empty; falling back to seed SQL metadata.");
      rows = await exportFromSeed(seedPath);
    } else {
      console.log(`Exported ${rows.length} question(s) from database.`);
    }
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, serializeQuestionCopyCsv(rows), "utf8");

  console.log(`Wrote ${out}`);
  console.log(`Columns: ${QUESTION_COPY_CSV_COLUMNS.join(", ")}`);
  console.log("Edit question_text, answer_0–answer_3, why_this_matters, recommended_actions.");
  console.log("Leave section_id and question_number unchanged, then run: npm run import:question-copy");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      await disconnectPrismaScript();
    }
  });
