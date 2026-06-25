/**
 * Backfill ClientAdvisorAssignment.includedPillars from legacy approval/assessment
 * rows. Idempotent — skips assignments that already have scope.
 *
 * Usage: npx tsx scripts/backfill-assignment-engagement-scope.ts
 *        DRY_RUN=1 npx tsx scripts/backfill-assignment-engagement-scope.ts
 */
import { prisma } from "@/lib/db";
import { getClientEngagementScope } from "@/lib/client/engagement-scope";

const dryRun = process.env.DRY_RUN === "1";

async function main() {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: {
      status: "ACTIVE",
      includedPillars: { isEmpty: true },
    },
    select: { id: true, clientId: true },
  });

  let updated = 0;
  let unchanged = 0;

  for (const assignment of assignments) {
    const before = await prisma.clientAdvisorAssignment.findUnique({
      where: { id: assignment.id },
      select: { includedPillars: true },
    });

    if ((before?.includedPillars.length ?? 0) > 0) {
      unchanged++;
      continue;
    }

    const scope = await getClientEngagementScope(assignment.clientId, {
      reconcile: !dryRun,
    });

    if (scope.includedPillars.length === 0) {
      unchanged++;
      continue;
    }

    updated++;
    console.log(
      `${dryRun ? "[dry-run] " : ""}client=${assignment.clientId} pillars=${scope.includedPillars.join(",")} source=${scope.source}`,
    );
  }

  console.log(
    `Done. ${updated} assignment(s) ${dryRun ? "would be " : ""}backfilled, ${unchanged} unchanged.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
