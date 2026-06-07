#!/usr/bin/env npx tsx
/**
 * Import reviewed question copy from CSV into the database and seed SQL.
 *
 * Usage:
 *   npm run import:question-copy
 *   npm run import:question-copy -- --file scripts/copy/question-bank-copy.csv
 *   DRY_RUN=1 npm run import:question-copy
 *   npm run import:question-copy -- --db-only
 *   npm run import:question-copy -- --seed-only
 */
import "./load-repo-env";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import {
  EDITABLE_COPY_FIELDS,
  nullIfBlank,
  parseQuestionCopyCsv,
  questionCopyKey,
} from "../src/lib/question-copy/csv";
import {
  patchQuestionSeedFile,
  patchQuestionSeedSql,
  type SeedCopyPatch,
} from "../src/lib/question-copy/seed-sql";
import { disconnectPrismaScript, prisma } from "./lib/prisma-for-scripts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_IN = resolve(repoRoot, "scripts/copy/question-bank-copy.csv");
const DEFAULT_SEED = resolve(repoRoot, "scripts/sql/belvedere-pillar-ddl-seed.sql");

function parseArgs(argv: string[]) {
  let file = process.env.QUESTION_COPY_IMPORT_PATH?.trim() || DEFAULT_IN;
  let seedPath = process.env.QUESTION_COPY_SEED_PATH?.trim() || DEFAULT_SEED;
  let dbOnly = false;
  let seedOnly = false;
  const dryRun =
    process.env.DRY_RUN === "1" ||
    process.env.DRY_RUN === "true" ||
    argv.includes("--dry-run");

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--file" && argv[i + 1]) {
      file = resolve(process.cwd(), argv[++i]!);
    } else if (arg === "--seed" && argv[i + 1]) {
      seedPath = resolve(process.cwd(), argv[++i]!);
    } else if (arg === "--db-only") {
      dbOnly = true;
    } else if (arg === "--seed-only") {
      seedOnly = true;
    }
  }

  if (dbOnly && seedOnly) {
    throw new Error("Use only one of --db-only or --seed-only.");
  }

  const applyDb = !seedOnly;
  const applySeed = !dbOnly;

  return { file, seedPath, dryRun, applyDb, applySeed };
}

function patchFromRow(row: Awaited<ReturnType<typeof parseQuestionCopyCsv>>[number]): SeedCopyPatch {
  return {
    questionText: nullIfBlank(row.question_text) ?? "",
    answer0: nullIfBlank(row.answer_0),
    answer1: nullIfBlank(row.answer_1),
    answer2: nullIfBlank(row.answer_2),
    answer3: nullIfBlank(row.answer_3),
    whyThisMatters: nullIfBlank(row.why_this_matters),
    recommendedActions: nullIfBlank(row.recommended_actions),
  };
}

async function main(): Promise<void> {
  const { file, seedPath, dryRun, applyDb, applySeed } = parseArgs(process.argv.slice(2));
  const rows = await parseQuestionCopyCsv(file);

  if (rows.length === 0) {
    throw new Error(`No rows found in ${file}`);
  }

  const updates = new Map<string, SeedCopyPatch>();
  for (const row of rows) {
    updates.set(questionCopyKey(row.section_id, row.question_number), patchFromRow(row));
  }

  console.log(`Loaded ${rows.length} row(s) from ${file}`);
  if (dryRun) console.log("[DRY RUN] No files or database rows will be modified.");

  let dbUpdated = 0;
  let dbMissing = 0;

  if (applyDb) {
    for (const row of rows) {
      const data = {
        questionText: nullIfBlank(row.question_text) ?? "",
        answer0: nullIfBlank(row.answer_0),
        answer1: nullIfBlank(row.answer_1),
        answer2: nullIfBlank(row.answer_2),
        answer3: nullIfBlank(row.answer_3),
        whyThisMatters: nullIfBlank(row.why_this_matters),
        recommendedActions: nullIfBlank(row.recommended_actions),
      };

      if (dryRun) {
        const existing = await prisma.pillarQuestion.findFirst({
          where: {
            sectionId: row.section_id,
            questionNumber: row.question_number,
          },
          select: { id: true },
        });
        if (existing) dbUpdated++;
        else dbMissing++;
        continue;
      }

      const result = await prisma.pillarQuestion.updateMany({
        where: {
          sectionId: row.section_id,
          questionNumber: row.question_number,
        },
        data,
      });

      if (result.count > 0) dbUpdated += result.count;
      else dbMissing++;
    }

    console.log(
      `${dryRun ? "Would update" : "Updated"} ${dbUpdated} database row(s)` +
        (dbMissing > 0 ? `; ${dbMissing} key(s) not found in database` : "")
    );
  }

  if (applySeed) {
    if (dryRun) {
      const { readFileSync } = await import("fs");
      const original = readFileSync(seedPath, "utf8");
      const result = patchQuestionSeedSql(original, new Map(updates));
      console.log(
        `Would patch ${result.patched} seed row(s) in ${seedPath}` +
          (result.missedKeys.length > 0
            ? `; ${result.missedKeys.length} key(s) not found in seed SQL`
            : "")
      );
    } else {
      const result = patchQuestionSeedFile(seedPath, updates);
      console.log(
        `Patched ${result.patched} seed row(s) in ${seedPath}` +
          (result.missedKeys.length > 0
            ? `; ${result.missedKeys.length} key(s) not found in seed SQL`
            : "")
      );
    }
  }

  console.log(`Editable fields: ${EDITABLE_COPY_FIELDS.join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnectPrismaScript();
  });
