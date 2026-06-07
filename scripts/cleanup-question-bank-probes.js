#!/usr/bin/env node
/**
 * Removes orphaned Playwright / admin-audit probe rows from the pillar question bank.
 *
 * Created by smoke tests in tests/smoke/epic-5.5-platform-admin.spec.ts when a run
 * fails before the test deletes the probe question. Safe to run repeatedly.
 *
 * Usage:
 *   node scripts/cleanup-question-bank-probes.js
 *   DRY_RUN=1 node scripts/cleanup-question-bank-probes.js
 *
 * Requires DATABASE_URL in `.env.local`.
 */

const path = require("path");
const repoRoot = path.resolve(__dirname, "..");
require("dotenv").config({ path: path.join(repoRoot, ".env.local"), quiet: true });
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

/** Prefixes written by epic-5.5-platform-admin Playwright probes. */
const PROBE_TEXT_PREFIXES = [
  "Playwright probe ",
  "Playwright edit probe ",
  "Playwright visibility probe ",
  "Audit probe ",
];

const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Add it to .env.local, then re-run.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function isProbeQuestionText(text) {
  const trimmed = (text ?? "").trim();
  return PROBE_TEXT_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

async function main() {
  const candidates = await prisma.pillarQuestion.findMany({
    where: {
      OR: PROBE_TEXT_PREFIXES.map((prefix) => ({
        questionText: { startsWith: prefix },
      })),
    },
    select: {
      id: true,
      questionNumber: true,
      questionText: true,
      displayOrder: true,
      section: {
        select: {
          code: true,
          category: { select: { kind: true } },
        },
      },
    },
    orderBy: [{ sectionId: "asc" }, { displayOrder: "asc" }],
  });

  const probes = candidates.filter((row) => isProbeQuestionText(row.questionText));

  if (probes.length === 0) {
    console.log("No question-bank probe rows found.");
    return;
  }

  console.log(
    `${dryRun ? "[DRY RUN] Would remove" : "Removing"} ${probes.length} probe question(s):`
  );
  for (const row of probes) {
    const section = row.section?.code ?? "?";
    const label = row.questionNumber ?? "(no number)";
    console.log(
      `  - ${section} ${label} order=${row.displayOrder}: ${row.questionText.slice(0, 72)}`
    );
  }

  const probeIds = probes.map((row) => row.id);

  const [responseCount, scoringRuleCount] = await Promise.all([
    prisma.assessmentResponse.count({ where: { questionId: { in: probeIds } } }),
    prisma.scoringRule.count({ where: { questionId: { in: probeIds } } }),
  ]);

  if (responseCount > 0) {
    console.log(`  + ${responseCount} assessment response(s) tied to probe question ids`);
  }
  if (scoringRuleCount > 0) {
    console.log(`  + ${scoringRuleCount} scoring rule(s) tied to probe question ids`);
  }

  if (dryRun) {
    console.log("DRY_RUN=1 — no rows deleted.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const deletedResponses = await tx.assessmentResponse.deleteMany({
      where: { questionId: { in: probeIds } },
    });
    const deletedRules = await tx.scoringRule.deleteMany({
      where: { questionId: { in: probeIds } },
    });
    const deletedQuestions = await tx.pillarQuestion.deleteMany({
      where: { id: { in: probeIds } },
    });

    console.log(
      `Deleted ${deletedQuestions.count} question(s), ${deletedResponses.count} assessment response(s), ${deletedRules.count} scoring rule(s).`
    );
  });
}

main()
  .catch((error) => {
    console.error("Cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
