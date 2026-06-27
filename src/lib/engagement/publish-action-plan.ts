import "server-only";

import { prisma } from "@/lib/db";

export type PublishResult = {
  publishedAt: Date;
  recommendationCount: number;
};

/**
 * Atomically publish an action plan for a completed assessment.
 *
 * Within a single transaction:
 * 1. Validates the assessment exists, is COMPLETED, and not already published
 * 2. Sets actionPlanPublishedAt timestamp on the Assessment
 * 3. Logs "action_plan_published" SolutionActivity for each client-visible recommendation
 *
 * Follows the transactional activity logging pattern from solution-lifecycle.ts.
 */
export async function publishActionPlan(input: {
  assessmentId: string;
  actorId: string;
}): Promise<PublishResult> {
  const { assessmentId, actorId } = input;
  const now = new Date();

  return await prisma.$transaction(async (tx) => {
    // 1. Read and validate the assessment
    const assessment = await tx.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
      select: {
        actionPlanPublishedAt: true,
        status: true,
        userId: true,
      },
    });

    // Idempotency guard: cannot publish twice
    if (assessment.actionPlanPublishedAt != null) {
      throw new Error("Action plan already published");
    }

    // Must be a completed assessment
    if (assessment.status !== "COMPLETED") {
      throw new Error(
        "Cannot publish action plan for an assessment that is not completed",
      );
    }

    // 2. Set the publish timestamp
    await tx.assessment.update({
      where: { id: assessmentId },
      data: { actionPlanPublishedAt: now },
    });

    // 3. Find all client-visible recommendations for this assessment
    const recommendations = await tx.assessmentRecommendation.findMany({
      where: {
        assessmentId,
        status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
        hiddenFromClient: false,
      },
      select: { id: true },
    });

    // 4. Log activity for each recommendation so the feed shows the publish event
    if (recommendations.length > 0) {
      await tx.solutionActivity.createMany({
        data: recommendations.map((rec) => ({
          assessmentRecommendationId: rec.id,
          actorId,
          action: "action_plan_published",
          detail: { assessmentId },
        })),
      });
    }

    return {
      publishedAt: now,
      recommendationCount: recommendations.length,
    };
  });
}
