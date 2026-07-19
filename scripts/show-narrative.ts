/**
 * Print the AI-generated narrative copy stored on an assessment's
 * recommendations. READ-ONLY — for eyeballing real model output after enabling
 * LLM_NARRATIVES_ENABLED and re-scoring, without writing SQL.
 *
 * Reads `customization.aiNarrative` (the per-recommendation copy) and
 * `generationMeta` (provider/model/validated/promptHash/generatedAt) written by
 * generate-narratives. Recommendations with no narrative show as "static copy"
 * — i.e. generation was off, skipped (thin grounding), or fail-closed.
 *
 * Usage:
 *   npx tsx scripts/show-narrative.ts <assessmentId>
 *   ASSESSMENT_ID=<id> npm run db:show-narrative
 */

import "./load-repo-env";
import { prisma } from "@/lib/db";
import type {
  GenerationMeta,
  StoredNarrative,
} from "@/lib/assessment/recommendations/llm-narrative/generate-narratives";

const assessmentId = process.argv[2] ?? process.env.ASSESSMENT_ID;

function asNarrative(customization: unknown): StoredNarrative | null {
  const c = customization as { aiNarrative?: StoredNarrative } | null;
  return c?.aiNarrative ?? null;
}

async function main(): Promise<void> {
  if (!assessmentId) {
    console.error("Usage: npx tsx scripts/show-narrative.ts <assessmentId>");
    process.exit(2);
  }

  const recs = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId },
    orderBy: { priority: "asc" },
    select: {
      serviceRecommendationId: true,
      priority: true,
      customization: true,
      generationMeta: true,
      serviceRecommendation: { select: { name: true } },
    },
  });

  console.log(`\nAI narratives — assessment ${assessmentId}\n${"─".repeat(72)}`);
  if (recs.length === 0) {
    console.log("No recommendations on this assessment.");
    return;
  }

  let withNarrative = 0;
  for (const rec of recs) {
    const narr = asNarrative(rec.customization);
    const meta = rec.generationMeta as GenerationMeta | null;

    console.log(`\n▸ ${rec.serviceRecommendation.name}  (${rec.serviceRecommendationId}, priority ${rec.priority})`);
    if (!narr) {
      console.log("  static copy — no AI narrative (generation off, skipped, or fail-closed).");
      continue;
    }
    withNarrative++;
    if (meta) {
      console.log(
        `  meta: ${meta.provider}/${meta.model}  validated=${meta.validated}  ` +
          `hash=${meta.promptHash}  at=${meta.generatedAt}`,
      );
    }
    console.log(`  summary : ${narr.pillarSummary}`);
    console.log(`  headline: ${narr.headline}`);
    console.log(`  rationale: ${narr.rationale}`);
    console.log(`  actions :`);
    for (const a of narr.tailoredActions) console.log(`     • ${a}`);
    console.log(`  cites   : ${narr.citedFindings.join(", ") || "(none)"}   confidence: ${narr.confidence}`);
  }

  console.log(`\n${"─".repeat(72)}`);
  console.log(`${withNarrative} of ${recs.length} recommendation(s) have AI narratives.`);
}

main()
  .catch((err) => {
    console.error("show-narrative failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(process.exitCode ?? 0);
  });
