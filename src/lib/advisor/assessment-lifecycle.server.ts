import "server-only";

import { tierIncludesFeature } from "@/lib/billing/tier-features";
import { getAdvisorSubscriptionTier } from "@/lib/advisor/subscription-tier.server";
import { getTargetedQuestionCount } from "@/lib/assessment/targeted-followup";

export async function getAdvisorAssessmentLifecycleContext(
  advisorUserId: string,
  assessment: { id: string; status: string } | null,
) {
  const tier = await getAdvisorSubscriptionTier(advisorUserId);
  const reassessmentEnabled = tierIncludesFeature(tier, "REASSESSMENT_WORKFLOW");
  let targetedQuestionCount = 0;
  if (assessment?.status === "COMPLETED") {
    targetedQuestionCount = await getTargetedQuestionCount(assessment.id);
  }
  return { reassessmentEnabled, targetedQuestionCount };
}
