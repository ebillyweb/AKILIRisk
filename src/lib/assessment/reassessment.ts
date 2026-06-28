import "server-only";

import { prisma } from "@/lib/db";
import type { ReassessmentInput, ReassessmentChainEntry } from "./reassessment-types";

/**
 * Create a new assessment linked to a previous one (D-04).
 *
 * - Uses prisma.$transaction for atomicity.
 * - Version is derived from chain length (NOT from Assessment.version, which
 *   is a rescore counter per Pitfall 2).
 * - All reassessments start fresh with no pre-filled answers (D-02).
 * - Reuses the previous assessment's snapshotId (Assumption A4).
 */
export async function createReassessment(
  input: ReassessmentInput,
): Promise<{ id: string; version: number }> {
  return prisma.$transaction(async (tx) => {
    const previous = await tx.assessment.findUniqueOrThrow({
      where: { id: input.previousAssessmentId },
      select: {
        id: true,
        userId: true,
        snapshotId: true,
        previousAssessmentId: true,
      },
    });

    // Walk the chain to compute reassessment sequence number.
    const chainLength = await walkChainLength(tx, previous.id);
    const reassessmentVersion = chainLength + 1;

    // Determine includedPillars based on reassessment type.
    let includedPillars: string[] = [];
    if (input.type === "pillar" && input.includedPillars?.length) {
      includedPillars = input.includedPillars;
    }
    // For "targeted", we could derive pillars from question IDs in the future,
    // but the plan says leave empty for now (full question set is filtered at
    // display time via targetedQuestionIds).

    const created = await tx.assessment.create({
      data: {
        userId: input.userId,
        previousAssessmentId: input.previousAssessmentId,
        status: "IN_PROGRESS",
        includedPillars,
        snapshotId: previous.snapshotId,
      },
      select: { id: true },
    });

    return { id: created.id, version: reassessmentVersion };
  });
}

/**
 * Walk the previousAssessmentId chain backwards to count total length.
 * Returns 1 for an assessment with no predecessor (it is the first).
 */
async function walkChainLength(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  assessmentId: string,
): Promise<number> {
  let count = 1;
  let currentId: string | null = assessmentId;

  while (currentId) {
    const row = await tx.assessment.findUnique({
      where: { id: currentId },
      select: { previousAssessmentId: true },
    });
    if (row?.previousAssessmentId) {
      count++;
      currentId = row.previousAssessmentId;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Walk the previousAssessmentId chain backwards from `assessmentId` and
 * return a chronological (oldest-first) array of chain entries.
 */
export async function getReassessmentChain(
  assessmentId: string,
): Promise<ReassessmentChainEntry[]> {
  const chain: ReassessmentChainEntry[] = [];
  let currentId: string | null = assessmentId;

  while (currentId) {
    const row = await prisma.assessment.findUnique({
      where: { id: currentId },
      select: {
        id: true,
        version: true,
        status: true,
        completedAt: true,
        createdAt: true,
        previousAssessmentId: true,
      },
    });
    if (!row) break;

    chain.push({
      id: row.id,
      version: row.version,
      status: row.status,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    });

    currentId = row.previousAssessmentId;
  }

  // Reverse to get oldest-first order.
  return chain.reverse();
}

/**
 * Find the most recent COMPLETED assessment for a user.
 */
export async function getLatestCompletedAssessment(
  userId: string,
): Promise<{ id: string; version: number } | null> {
  const assessment = await prisma.assessment.findFirst({
    where: { userId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    select: { id: true, version: true },
  });

  return assessment;
}
