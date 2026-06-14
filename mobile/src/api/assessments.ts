import { apiRequest } from './client';
import { Assessment, AssessmentList } from '@/types';

/** Lists the authenticated user's assessments (most recent first). */
export async function listAssessments(): Promise<Assessment[]> {
  const raw = await apiRequest<unknown>('/api/assessment');
  return AssessmentList.parse(raw);
}

/** Fetches a single assessment with its pillar scores. */
export async function getAssessment(id: string): Promise<Assessment> {
  const raw = await apiRequest<unknown>(`/api/assessment/${id}`);
  return Assessment.parse(raw);
}

/** Fetches computed pillar scores for an assessment. */
export async function getAssessmentScore(id: string): Promise<Assessment> {
  const raw = await apiRequest<unknown>(`/api/assessment/${id}/score`);
  // The score endpoint may return either an assessment-shaped object or a
  // scores wrapper; Assessment's schema tolerates both via optional fields.
  return Assessment.parse(raw);
}
