/**
 * Staging dry-run for Phase 3 LLM narrative generation. READ-ONLY.
 *
 * Validates the risky part of the pipeline — the DB data layer (answer
 * decryption + question-bank join) — against real data, and exercises the real
 * orchestrator (pillar grouping, grounding validation, fail-closed skip logic)
 * WITHOUT calling any model or writing to the database:
 *   - the generator is a synthetic, schema-valid stand-in (marked below), and
 *   - `persist` is captured to memory, never written.
 *
 * So "weak findings" and the service→pillar map printed here are REAL; the
 * narrative text is synthetic. If weak findings come back empty for every
 * pillar, the decrypted-answer shape assumption is wrong and generation would
 * safely no-op in production — that is exactly what this script surfaces before
 * the flag is switched on.
 *
 * Usage:
 *   npx tsx scripts/narrative-generation-dry-run.ts <assessmentId>
 *   ASSESSMENT_ID=<id> npm run db:narrative-dry-run
 */

import "./load-repo-env";
import { prisma } from "@/lib/db";
import { safeDecryptAnswer } from "@/lib/data/response-content";
import {
  loadWeakFindingsByPillar,
  loadServicePillarMap,
} from "@/lib/assessment/recommendations/llm-narrative/narrative-data";
import {
  runNarrativeGeneration,
  loadRecommendationsFromDb,
  type NarrativeDeps,
  type PillarMeta,
  type GenerationMeta,
  type StoredNarrative,
} from "@/lib/assessment/recommendations/llm-narrative/generate-narratives";
import { normalizePillarScoreId } from "@/lib/assessment/pillar-registry";
import type { NarrativeInput, NarrativeOutput } from "@/lib/assessment/recommendations/llm-narrative/shape-a-prompt";

const assessmentId = process.argv[2] ?? process.env.ASSESSMENT_ID;

/** A schema-valid narrative synthesized from the input — the model is NOT called. */
function syntheticGenerate(input: NarrativeInput): Promise<NarrativeOutput> {
  const cite = input.weakFindings[0]?.questionNumber;
  return Promise.resolve({
    pillarSummary: `[synthetic] Posture summary for ${input.pillar.name}.`,
    recommendations: input.selectedServices.map((s) => ({
      serviceId: s.serviceId,
      headline: `[synthetic] ${s.name}`,
      rationale: cite
        ? `Grounded in finding ${cite} ("${input.weakFindings[0].chosenLabel}"), this service closes the gap.`
        : "General rationale.",
      tailoredActions: ["Review the identified gap", "Assign an owner and a review date"],
      citedFindings: cite ? [cite] : [],
      confidence: cite ? "medium" : "low",
    })),
  });
}

/** Classify a decrypted answer by SHAPE only — never prints the value's text. */
function classifyShape(v: unknown): string {
  if (v === null || v === undefined) return "null/undefined";
  if (typeof v === "number") return Number.isInteger(v) && v >= 0 && v <= 3 ? "0-3 integer" : "number(other)";
  if (typeof v === "string") {
    const n = Number(v);
    return v.trim() !== "" && Number.isInteger(n) && n >= 0 && n <= 3
      ? "0-3 numeric-string"
      : "string(other)";
  }
  if (typeof v === "object") return `object{${Object.keys(v as object).slice(0, 4).join(",")}}`;
  return typeof v;
}

function tally(items: string[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts.entries()].map(([k, n]) => `${k}: ${n}`).join("  ");
}

/**
 * Explain WHY weak findings may be empty — distinguishes "no responses" from
 * "wrong id-space (cloned methodology)" from "unexpected answer shape". Prints
 * shapes and question-table membership only; no answer text.
 */
async function diagnose(assessmentId: string): Promise<void> {
  console.log(`\nDiagnostics (READ-ONLY, shapes only — no answer text printed):`);

  const responses = await prisma.assessmentResponse.findMany({
    where: { assessmentId },
    select: { questionId: true, pillar: true, answer: true, skipped: true },
  });
  const nonSkipped = responses.filter((r) => !r.skipped);
  console.log(`  AssessmentResponse rows: ${responses.length} total, ${nonSkipped.length} non-skipped`);
  if (responses.length === 0) {
    console.log("  → No responses stored for this assessment. Nothing to ground on.");
    return;
  }

  const qids = [...new Set(nonSkipped.map((r) => r.questionId))];

  // Which question table do the response ids live in? (uuid-cast can throw for
  // non-uuid ids — that itself tells us the ids aren't platform questions.)
  const tableProbe = async (
    label: string,
    fn: () => Promise<Array<{ id: string }>>,
  ): Promise<void> => {
    try {
      const rows = await fn();
      console.log(`  ids in ${label.padEnd(24)}: ${rows.length} / ${qids.length}`);
    } catch (e) {
      console.log(`  ids in ${label.padEnd(24)}: query errored (${e instanceof Error ? e.message.split("\n")[0] : e})`);
    }
  };
  await tableProbe("questions (platform)", () =>
    prisma.pillarQuestion.findMany({ where: { id: { in: qids } }, select: { id: true } }),
  );
  await tableProbe("advisor_pillar_questions", () =>
    prisma.advisorPillarQuestion.findMany({ where: { id: { in: qids } }, select: { id: true } }),
  );
  await tableProbe("enterprise_pillar_questions", () =>
    prisma.enterprisePillarQuestion.findMany({ where: { id: { in: qids } }, select: { id: true } }),
  );

  // Decrypted answer shapes (what loadWeakFindingsByPillar keys on).
  const shapes: string[] = [];
  for (const r of nonSkipped.slice(0, 200)) {
    try {
      shapes.push(classifyShape(safeDecryptAnswer(r.answer as unknown as string | null, {
        rowId: r.questionId,
        column: "AssessmentResponse.answer",
      })));
    } catch {
      shapes.push("decrypt-error");
    }
  }
  console.log(`  Decrypted answer shapes (first ${shapes.length}): ${tally(shapes)}`);
  console.log(`  Responses by pillar slug: ${tally(nonSkipped.map((r) => r.pillar))}`);

  // Staged breakdown: where do weak findings get lost? Level distribution, then
  // how many weak (<=1) answers survive the anchor-label requirement.
  const questions = await prisma.pillarQuestion.findMany({
    where: { id: { in: qids } },
    select: { id: true, answer0: true, answer1: true, answer2: true, answer3: true },
  });
  const anchorsById = new Map(
    questions.map((q) => [q.id, [q.answer0, q.answer1, q.answer2, q.answer3] as (string | null)[]]),
  );
  const levelCounts = [0, 0, 0, 0];
  let nonInt = 0;
  let weakCandidates = 0;
  let weakWithAnchor = 0;
  let weakMissingAnchor = 0;
  for (const r of nonSkipped) {
    const v = safeDecryptAnswer(r.answer as unknown as string | null, {
      rowId: r.questionId,
      column: "AssessmentResponse.answer",
    });
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 3) {
      nonInt++;
      continue;
    }
    levelCounts[n]++;
    if (n <= 1) {
      weakCandidates++;
      const anchor = anchorsById.get(r.questionId)?.[n];
      if (anchor && anchor.trim()) weakWithAnchor++;
      else weakMissingAnchor++;
    }
  }
  console.log(
    `  Maturity levels: 0=${levelCounts[0]} 1=${levelCounts[1]} 2=${levelCounts[2]} 3=${levelCounts[3]}` +
      (nonInt ? ` (non-0-3: ${nonInt})` : ""),
  );
  console.log(
    `  Weak (<=1): ${weakCandidates}  → with anchor label: ${weakWithAnchor}  dropped (missing anchor): ${weakMissingAnchor}`,
  );
  if (weakCandidates > 0 && weakWithAnchor === 0) {
    console.log("  → CAUSE: weak answers exist but their anchor labels are empty in `questions`.");
  } else if (weakCandidates === 0) {
    console.log("  → CAUSE: no answer is at maturity <=1 — genuinely nothing to flag here.");
  }
}

async function main(): Promise<void> {
  if (!assessmentId) {
    console.error("Usage: npx tsx scripts/narrative-generation-dry-run.ts <assessmentId>");
    process.exit(2);
  }

  console.log(`\nNarrative generation dry-run (READ-ONLY) — assessment ${assessmentId}\n${"─".repeat(64)}`);

  await diagnose(assessmentId);

  // 1. REAL data layer — the part that needs live validation. Pillar metadata is
  // read straight from PillarScore here (slug as display name) so the dry-run
  // avoids the `server-only` catalog module and can run from any CLI.
  const riskMap: Record<string, PillarMeta["riskLevel"]> = {
    LOW: "low",
    MEDIUM: "medium",
    HIGH: "high",
    CRITICAL: "critical",
  };
  const [weakByPillar, servicePillar, recommendations, pillarScores] = await Promise.all([
    loadWeakFindingsByPillar(assessmentId),
    loadServicePillarMap(),
    loadRecommendationsFromDb(assessmentId),
    prisma.pillarScore.findMany({
      where: { assessmentId },
      select: { pillar: true, score: true, riskLevel: true },
    }),
  ]);
  const pillarMeta = new Map<string, PillarMeta>(
    pillarScores.map((s) => {
      const slug = normalizePillarScoreId(s.pillar);
      return [slug, { name: slug, score: s.score, riskLevel: riskMap[s.riskLevel] ?? "medium" }];
    }),
  );

  console.log(`\nService→pillar map: ${servicePillar.size} services mapped`);
  console.log(`Recommendations on this assessment: ${recommendations.length}`);
  console.log(`Pillars scored: ${pillarMeta.size}`);

  console.log(`\nWeak findings by pillar (REAL — proves decryption + question join):`);
  if (weakByPillar.size === 0) {
    console.log("  ⚠️  NONE. Either the assessment has no weak answers, or the decrypted");
    console.log("      answer shape is not a 0–3 integer. Generation would safely no-op.");
  } else {
    for (const [pillar, findings] of weakByPillar) {
      const sample = findings[0];
      console.log(
        `  • ${pillar.padEnd(24)} ${findings.length} finding(s)` +
          (sample ? `  e.g. ${sample.questionNumber} = ${sample.chosenLevel} "${sample.chosenLabel}"` : ""),
      );
    }
  }

  // 2. REAL orchestrator, synthetic generator, captured (never written) persist.
  const captured: Array<{ recId: string; serviceId: string; validated: boolean }> = [];
  const deps: NarrativeDeps = {
    loadRecommendations: async () => recommendations,
    loadPillarMeta: async () => pillarMeta,
    loadWeakFindingsByPillar: async () => weakByPillar,
    loadServicePillarMap: async () => servicePillar,
    generate: syntheticGenerate,
    persist: async (recId: string, _n: StoredNarrative, meta: GenerationMeta) => {
      captured.push({ recId, serviceId: "", validated: meta.validated });
    },
    model: "dry-run",
    now: () => new Date(0).toISOString(),
  };

  const summary = await runNarrativeGeneration(assessmentId, deps);

  console.log(`\nOrchestrator decisions (grouping + validation + skip logic are REAL):`);
  console.log(`  pillars processed : ${summary.pillarsProcessed}`);
  console.log(`  would generate    : ${summary.pillarsSucceeded}`);
  console.log(`  skipped (no grounding / unmapped): ${summary.pillarsSkipped}`);
  console.log(`  validation-failed : ${summary.pillarsFailed}`);
  console.log(`  narratives that WOULD be written (synthetic): ${summary.narrativesWritten}`);

  console.log(`\n${"─".repeat(64)}`);
  console.log(
    weakByPillar.size > 0 && summary.narrativesWritten > 0
      ? "✅ Data layer produced groundable findings and the orchestrator would write copy."
      : "⚠️  No narratives would be written — inspect the weak-findings output above.",
  );
  console.log("(No model was called and nothing was written to the database.)\n");
}

main()
  .catch((err) => {
    console.error("Dry-run failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(process.exitCode ?? 0);
  });
