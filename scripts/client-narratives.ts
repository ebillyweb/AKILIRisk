/**
 * Show, for a client (by userId — the [clientId] in the advisor Guidance URL),
 * which of their COMPLETED assessments' recommendations have an AI narrative and
 * its review status. READ-ONLY. Tells you whether the advisor panel is empty
 * because nothing was generated (→ run generate-narratives-once) or because a
 * generated narrative isn't surfacing (→ mapper bug).
 *
 * Usage: npx tsx scripts/client-narratives.ts <clientId>
 */

import "./load-repo-env";
import { prisma } from "@/lib/db";
import { parseReview } from "@/lib/assessment/recommendations/llm-narrative/narrative-review";

const clientId = process.argv[2] ?? process.env.CLIENT_ID;

async function main(): Promise<void> {
  if (!clientId) {
    console.error("Usage: npx tsx scripts/client-narratives.ts <clientId>");
    process.exit(2);
  }

  const assessments = await prisma.assessment.findMany({
    where: { userId: clientId, status: "COMPLETED" },
    select: { id: true, completedAt: true },
    orderBy: { completedAt: "desc" },
  });

  console.log(`\nClient ${clientId} — COMPLETED assessments: ${assessments.length}\n${"─".repeat(64)}`);
  if (assessments.length === 0) {
    console.log("No COMPLETED assessments → the Guidance page has no recommendations to show.");
    return;
  }

  let totalRecs = 0;
  let withNarrative = 0;
  for (const a of assessments) {
    const recs = await prisma.assessmentRecommendation.findMany({
      where: { assessmentId: a.id },
      select: {
        serviceRecommendationId: true,
        customization: true,
        serviceRecommendation: { select: { name: true } },
      },
    });
    console.log(`\nAssessment ${a.id} — ${recs.length} recommendation(s):`);
    for (const rec of recs) {
      totalRecs++;
      const c = (rec.customization as Record<string, unknown> | null) ?? {};
      const hasNarrative = Boolean(c.aiNarrative);
      if (hasNarrative) withNarrative++;
      const review = parseReview(c.aiNarrativeReview);
      console.log(
        `  ${hasNarrative ? "✓ narrative" : "✗ none     "}  ${rec.serviceRecommendation.name}` +
          (hasNarrative ? `  [${review.status}${review.edited ? ", edited" : ""}]` : ""),
      );
    }
  }

  console.log(`\n${"─".repeat(64)}`);
  console.log(`${withNarrative} of ${totalRecs} recommendation(s) have an AI narrative.`);
  if (withNarrative === 0) {
    console.log("→ None generated for this client. Generate one:");
    console.log(`   npx tsx scripts/generate-narratives-once.ts ${assessments[0].id}`);
  } else {
    console.log("→ Narratives exist. If the advisor panel is still empty, it's a UI/mapper issue.");
  }
}

main()
  .catch((err) => {
    console.error("client-narratives failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(process.exitCode ?? 0);
  });
