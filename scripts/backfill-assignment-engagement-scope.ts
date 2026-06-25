/**
 * Backfill ClientAdvisorAssignment.includedPillars from legacy approval/assessment
 * rows. Idempotent — skips assignments that already have scope.
 *
 * Usage: npx tsx scripts/backfill-assignment-engagement-scope.ts
 *        DRY_RUN=1 npx tsx scripts/backfill-assignment-engagement-scope.ts
 */
import {
  disconnectPrismaScript,
  prisma,
} from "./lib/prisma-for-scripts.js";

const dryRun = process.env.DRY_RUN === "1";

type LegacyScope = {
  includedPillars: string[];
  focusAreas: string[];
  source: "approval" | "assessment" | null;
};

async function resolveLegacyScope(clientId: string): Promise<LegacyScope> {
  const approval = await prisma.intakeApproval.findFirst({
    where: {
      status: "APPROVED",
      interview: { userId: clientId },
    },
    orderBy: { approvedAt: "desc" },
    select: { includedPillars: true, focusAreas: true },
  });

  if (approval && approval.includedPillars.length > 0) {
    return {
      includedPillars: approval.includedPillars,
      focusAreas:
        approval.focusAreas.length > 0
          ? approval.focusAreas
          : approval.includedPillars,
      source: "approval",
    };
  }

  const assessment = await prisma.assessment.findFirst({
    where: {
      userId: clientId,
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
    },
    orderBy: { updatedAt: "desc" },
    select: { includedPillars: true },
  });

  if (assessment?.includedPillars.length) {
    return {
      includedPillars: assessment.includedPillars,
      focusAreas: assessment.includedPillars,
      source: "assessment",
    };
  }

  return { includedPillars: [], focusAreas: [], source: null };
}

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
    const legacy = await resolveLegacyScope(assignment.clientId);
    if (legacy.includedPillars.length === 0) {
      unchanged++;
      continue;
    }

    updated++;
    console.log(
      `${dryRun ? "[dry-run] " : ""}client=${assignment.clientId} pillars=${legacy.includedPillars.join(",")} source=${legacy.source}`,
    );

    if (!dryRun) {
      await prisma.clientAdvisorAssignment.update({
        where: { id: assignment.id },
        data: {
          includedPillars: legacy.includedPillars,
          focusAreas: legacy.focusAreas,
        },
      });
    }
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
  .finally(() => disconnectPrismaScript());
