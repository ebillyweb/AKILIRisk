/**
 * Diagnose a PILLAR_OUT_OF_SCOPE error. READ-ONLY.
 *
 * Prints an assessment's included_pillars, flags any slug that is NOT in the
 * current pillar catalog (a stale slug — e.g. the pre-rename
 * "family-governance-behavioral" that the rename migration never updated in the
 * included_pillars arrays), and shows which pillars actually have scores. Also
 * does a global count of the known old slug so the blast radius is visible.
 *
 * Usage:
 *   npx tsx scripts/check-pillar-scope.ts <assessmentId>
 */

import "./load-repo-env";
import { prisma } from "@/lib/db";

const assessmentId = process.argv[2] ?? process.env.ASSESSMENT_ID;
const OLD_SLUG = "family-governance-behavioral";
const NEW_SLUG = "ai-emerging-tech";

async function main(): Promise<void> {
  if (!assessmentId) {
    console.error("Usage: npx tsx scripts/check-pillar-scope.ts <assessmentId>");
    process.exit(2);
  }

  const [assessment, pillars, scores] = await Promise.all([
    prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { includedPillars: true },
    }),
    prisma.pillar.findMany({ select: { slug: true } }),
    prisma.pillarScore.findMany({ where: { assessmentId }, select: { pillar: true } }),
  ]);

  console.log(`\nScope check — assessment ${assessmentId}\n${"─".repeat(64)}`);
  if (!assessment) {
    console.log("Assessment not found.");
    return;
  }

  const catalog = new Set(pillars.map((p) => p.slug));
  const included = assessment.includedPillars ?? [];

  if (included.length === 0) {
    console.log("included_pillars is EMPTY → scope resolves to ALL catalog pillars.");
    console.log("A scope error is not possible from this assessment's scope.");
  } else {
    console.log(`included_pillars (${included.length}):`);
    for (const slug of included) {
      const stale = !catalog.has(slug);
      console.log(`  ${stale ? "✗ STALE" : "✓ ok   "}  ${slug}`);
    }
    const stale = included.filter((s) => !catalog.has(s));
    if (stale.length) {
      console.log(`\n⚠️  ${stale.length} slug(s) not in the current catalog: ${stale.join(", ")}`);
      if (stale.includes(OLD_SLUG)) {
        console.log(`   This is the pre-rename slug. Scoring "${NEW_SLUG}" here fails the scope guard.`);
      }
    } else {
      console.log("\nAll included slugs are valid — no stale-slug problem on this assessment.");
      console.log(`If you hit the error, you scored a pillar NOT in the ${included.length}-pillar scope above.`);
    }
  }

  console.log(`\nPillars with scores: ${scores.map((s) => s.pillar).join(", ") || "(none)"}`);

  // Blast radius: how many assessments still carry the old slug.
  const staleCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT count(*)::bigint AS count FROM "Assessment" WHERE ${OLD_SLUG} = ANY("included_pillars")
  `;
  console.log(`\nGlobal: ${staleCount[0]?.count ?? 0} assessment(s) still list "${OLD_SLUG}" in included_pillars.`);
}

main()
  .catch((err) => {
    console.error("check-pillar-scope failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(process.exitCode ?? 0);
  });
