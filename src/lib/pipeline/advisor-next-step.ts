import type { DeliverablePhase } from "@prisma/client";
import { isDeliverableProfilePublished } from "@/lib/assessment/plan-depth";

export type AdvisorPipelineNextStep = {
  /** Short eyebrow / kicker above the title. */
  kicker: string;
  title: string;
  detail: string;
  ctaLabel: string;
  /** Path relative to the app root (e.g. `/advisor/pipeline/...`). */
  href: string;
  /** Visual emphasis for banners. */
  tone: "primary" | "success" | "secondary";
};

/**
 * Advisor-facing next action after (or during) a client's assessment.
 * Returns null when there is no assessment-driven next step to surface.
 */
export function resolveAdvisorAssessmentNextStep(input: {
  clientId: string;
  assessmentId?: string | null;
  assessmentStatus: string | null | undefined;
  deliverablePhase: DeliverablePhase | null | undefined;
  documentsNeeded?: boolean;
  actionPlanEnabled?: boolean;
}): AdvisorPipelineNextStep | null {
  const { clientId, assessmentStatus, deliverablePhase } = input;
  if (!assessmentStatus) return null;

  if (assessmentStatus === "IN_PROGRESS") {
    const reviewHref = input.assessmentId
      ? `/advisor/pipeline/${clientId}/assessment/${input.assessmentId}`
      : `/advisor/pipeline/${clientId}`;
    return {
      kicker: "Next step",
      title: "Client is still in the assessment",
      detail:
        "Review in-progress answers anytime. When every selected domain is scored, publish their Risk Profile so they can see full results and an action plan.",
      ctaLabel: input.assessmentId ? "Review in-progress answers" : "Open client detail",
      href: reviewHref,
      tone: "secondary",
    };
  }

  if (assessmentStatus !== "COMPLETED") return null;

  const phase = deliverablePhase ?? "PREVIEW";

  if (!isDeliverableProfilePublished(phase)) {
    return {
      kicker: "Next step",
      title: "Publish the Risk Profile",
      detail:
        "The questionnaire is complete and the client can already see a Risk Preview. Draft and publish the report to unlock full results and the action plan on their side.",
      ctaLabel: "Open reports",
      href: `/advisor/pipeline/${clientId}/report`,
      tone: "primary",
    };
  }

  if (input.documentsNeeded) {
    return {
      kicker: "Next step",
      title: "Collect remaining documents",
      detail:
        "The Risk Profile is published. Finish outstanding document requirements to close this household’s workflow.",
      ctaLabel: "Open client detail",
      href: `/advisor/pipeline/${clientId}`,
      tone: "secondary",
    };
  }

  if (phase === "PORTFOLIO") {
    return {
      kicker: "Next step",
      title: "Continue portfolio engagement",
      detail:
        "The client accepted the advisory recommendation. Use analytics and guidance to schedule follow-up and track remediation.",
      ctaLabel: input.actionPlanEnabled === false ? "View analytics" : "Open client guidance",
      href:
        input.actionPlanEnabled === false
          ? `/advisor/analytics/${clientId}`
          : `/advisor/clients/${clientId}/guidance`,
      tone: "success",
    };
  }

  return {
    kicker: "Next step",
    title: "Client can review full results",
    detail:
      "The Risk Profile is published. Reach out within your advisory SLA, and use guidance to help them prioritize remediation.",
    ctaLabel: input.actionPlanEnabled === false ? "View analytics" : "Open client guidance",
    href:
      input.actionPlanEnabled === false
        ? `/advisor/analytics/${clientId}`
        : `/advisor/clients/${clientId}/guidance`,
    tone: "success",
  };
}
