/** Canonical admin routes for personal risk profile question bank (pillar DDL). */
export const ADMIN_ASSESSMENT_QUESTIONS_PATH = "/admin/assessment/questions";

export function adminAssessmentQuestionsAreaPath(riskAreaId: string): string {
  return `${ADMIN_ASSESSMENT_QUESTIONS_PATH}/${riskAreaId}`;
}

export function adminAssessmentQuestionsNewPath(riskAreaId: string): string {
  return `${adminAssessmentQuestionsAreaPath(riskAreaId)}/new`;
}

export function adminAssessmentQuestionsEditPath(
  riskAreaId: string,
  questionId: string
): string {
  return `${adminAssessmentQuestionsAreaPath(riskAreaId)}/${encodeURIComponent(questionId)}`;
}
