/**
 * Run Phase 3 narrative generation for a single assessment, once, on demand.
 *
 * ⚠️ THIS WRITES TO THE DATABASE. Unlike narrative-generation-dry-run.ts, this
 * makes the real OpenAI call and persists customization.aiNarrative +
 * generationMeta on the assessment's recommendations — exactly what the score
 * route does when the flag is on. Use it to validate the live adapter and
 * produce real copy without deploying the branch.
 *
 * Requires OPENAI_API_KEY in the environment (pull preview env first:
 * `npm run env:vercel:preview`). Fail-closed: if the model errors or its output
 * fails the grounding validator, that pillar keeps its static copy.
 *
 * Usage:
 *   npx tsx scripts/generate-narratives-once.ts <assessmentId>
 * Then inspect:
 *   npx tsx scripts/show-narrative.ts <assessmentId>
 */

import "./load-repo-env";
import { prisma } from "@/lib/db";
import { isNarrativeGenerationEnabled } from "@/lib/assessment/recommendations/llm-narrative/config";
import { generateAndAttachNarratives } from "@/lib/assessment/recommendations/llm-narrative/generate-narratives";

const assessmentId = process.argv[2] ?? process.env.ASSESSMENT_ID;

async function main(): Promise<void> {
  if (!assessmentId) {
    console.error("Usage: npx tsx scripts/generate-narratives-once.ts <assessmentId>");
    process.exit(2);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Pull preview env first: npm run env:vercel:preview");
    process.exit(2);
  }

  console.log(`\nGenerating narratives (WRITES TO DB) — assessment ${assessmentId}`);
  console.log(`Flag LLM_NARRATIVES_ENABLED: ${isNarrativeGenerationEnabled()} (not required for this manual run)`);
  console.log("Calling OpenAI and persisting validated output…\n");

  const summary = await generateAndAttachNarratives(assessmentId);

  console.log("Result:");
  console.log(`  pillars processed : ${summary.pillarsProcessed}`);
  console.log(`  succeeded         : ${summary.pillarsSucceeded}`);
  console.log(`  skipped           : ${summary.pillarsSkipped}`);
  console.log(`  validation-failed : ${summary.pillarsFailed}`);
  console.log(`  narratives written: ${summary.narrativesWritten}`);
  console.log(
    summary.narrativesWritten > 0
      ? `\n✅ Wrote ${summary.narrativesWritten} narrative(s). Inspect: npx tsx scripts/show-narrative.ts ${assessmentId}`
      : "\n⚠️  Nothing written — no recommendation had groundable findings, or generation failed closed.",
  );
}

main()
  .catch((err) => {
    console.error("generate-narratives-once failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(process.exitCode ?? 0);
  });
