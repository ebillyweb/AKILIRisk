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

async function main(): Promise<void> {
  if (!assessmentId) {
    console.error("Usage: npx tsx scripts/narrative-generation-dry-run.ts <assessmentId>");
    process.exit(2);
  }

  console.log(`\nNarrative generation dry-run (READ-ONLY) — assessment ${assessmentId}\n${"─".repeat(64)}`);

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
