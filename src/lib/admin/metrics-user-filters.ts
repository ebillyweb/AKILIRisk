import "server-only";

import type { Prisma } from "@prisma/client";

/** Active production users included in platform KPI / analytics dashboards. */
export const PRODUCTION_USER_METRICS_WHERE: Pick<Prisma.UserWhereInput, "isTestAccount"> = {
  isTestAccount: false,
};

export function productionUserWhere(
  base: Prisma.UserWhereInput = {},
): Prisma.UserWhereInput {
  return { ...base, ...PRODUCTION_USER_METRICS_WHERE };
}

/** Assessments owned by production (non-test) client accounts. */
export const PRODUCTION_CLIENT_ASSESSMENT_WHERE: Prisma.AssessmentWhereInput = {
  user: PRODUCTION_USER_METRICS_WHERE,
};

/** Intake interviews for production client accounts. */
export const PRODUCTION_CLIENT_INTAKE_INTERVIEW_WHERE: Prisma.IntakeInterviewWhereInput =
  {
    user: PRODUCTION_USER_METRICS_WHERE,
  };

/** Intake approvals for production client accounts. */
export const PRODUCTION_CLIENT_INTAKE_APPROVAL_WHERE: Prisma.IntakeApprovalWhereInput =
  {
    interview: PRODUCTION_CLIENT_INTAKE_INTERVIEW_WHERE,
  };

/** Active assignments where both client and advisor are production accounts. */
export const PRODUCTION_CLIENT_ASSIGNMENT_WHERE: Prisma.ClientAdvisorAssignmentWhereInput =
  {
    client: PRODUCTION_USER_METRICS_WHERE,
    advisor: { user: PRODUCTION_USER_METRICS_WHERE },
  };

/** Published/draft reports for production client assessments. */
export const PRODUCTION_CLIENT_REPORT_WHERE: Prisma.ReportWhereInput = {
  assessment: PRODUCTION_CLIENT_ASSESSMENT_WHERE,
};

/** Advisor subscriptions that belong to production advisor accounts. */
export const PRODUCTION_ADVISOR_SUBSCRIPTION_WHERE: Prisma.SubscriptionWhereInput = {
  user: PRODUCTION_USER_METRICS_WHERE,
};

/** Assessment recommendations tied to production client assessments. */
export const PRODUCTION_ASSESSMENT_RECOMMENDATION_WHERE: Prisma.AssessmentRecommendationWhereInput =
  {
    assessment: PRODUCTION_CLIENT_ASSESSMENT_WHERE,
  };
