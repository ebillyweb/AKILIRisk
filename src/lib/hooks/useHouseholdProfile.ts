import { useQuery } from '@tanstack/react-query';
import { getClientAssessmentHouseholdProfile } from '@/lib/actions/profile-actions';

/**
 * Client assessment household profile (US-22 / US-23). Returns null when
 * the advisor disabled household profiles (US-49) or the client has no
 * members. Includes all members regardless of shareWithAdvisor (US-48).
 */
export function useHouseholdProfile() {
  const query = useQuery({
    queryKey: ['household-profile'],
    queryFn: async () => {
      const result = await getClientAssessmentHouseholdProfile();
      if (!result.success) {
        throw new Error(result.error ?? 'Failed to load household profile');
      }
      return result.profile;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
