/**
 * Print who owns an assessment and which advisor is assigned — so you can open
 * the right advisor Guidance page (/advisor/clients/<clientId>/guidance) and
 * sign in as the right advisor. READ-ONLY.
 *
 * Usage: npx tsx scripts/whose-assessment.ts <assessmentId>
 */

import "./load-repo-env";
import { prisma } from "@/lib/db";

const assessmentId = process.argv[2] ?? process.env.ASSESSMENT_ID;

async function main(): Promise<void> {
  if (!assessmentId) {
    console.error("Usage: npx tsx scripts/whose-assessment.ts <assessmentId>");
    process.exit(2);
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { userId: true, status: true },
  });
  if (!assessment) {
    console.log("Assessment not found.");
    return;
  }

  const recCount = await prisma.assessmentRecommendation.count({ where: { assessmentId } });

  console.log(`\nAssessment ${assessmentId}\n${"─".repeat(64)}`);
  console.log(`status: ${assessment.status}   recommendations: ${recCount}`);
  console.log(`\nclientId (for the Guidance URL): ${assessment.userId}`);
  console.log(`Guidance page: /advisor/clients/${assessment.userId}/guidance`);

  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { clientId: assessment.userId, status: "ACTIVE" },
    select: { advisor: { select: { id: true, firmName: true, userId: true } } },
  });

  console.log(`\nActive advisor assignment(s): ${assignments.length}`);
  for (const a of assignments) {
    console.log(`  • ${a.advisor.firmName ?? "(no firm name)"}  advisorUserId=${a.advisor.userId}`);
  }
  if (assignments.length === 0) {
    console.log("  ⚠️  No active advisor — no advisor can open this client's Guidance page.");
  } else {
    console.log("\nSign in as the advisor whose account is that advisorUserId, then open the Guidance URL above.");
  }
}

main()
  .catch((err) => {
    console.error("whose-assessment failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(process.exitCode ?? 0);
  });
