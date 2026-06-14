import { useQuery } from '@tanstack/react-query';
import { getAssessment, listAssessments } from '@/api/assessments';
import { queryKeys } from '@/api/queryClient';

export function useAssessments() {
  return useQuery({
    queryKey: queryKeys.assessments,
    queryFn: listAssessments,
  });
}

export function useAssessment(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assessment(id ?? ''),
    queryFn: () => getAssessment(id as string),
    enabled: Boolean(id),
  });
}
