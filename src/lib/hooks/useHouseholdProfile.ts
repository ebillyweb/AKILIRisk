import { useQuery } from '@tanstack/react-query';
import { getHouseholdMembers } from '@/lib/actions/profile-actions';
import type { HouseholdProfile } from '@/lib/assessment/personalization';

/**
 * Round-11 commit 2.2 (BRD §5.1 amendment): demographic-only profile
 * shape. Member rows now carry displayLabel + birthYear + sex instead
 * of fullName + age. Cast through unknown until prisma generate
 * regenerates the client locally.
 */
export function useHouseholdProfile() {
  const query = useQuery({
    queryKey: ['household-profile'],
    queryFn: async () => {
      const result = await getHouseholdMembers();
      if (!result.success || !result.members || result.members.length === 0) {
        return null;
      }
      const profile: HouseholdProfile = {
        members: result.members.map(raw => {
          const m = raw as unknown as Record<string, unknown>;
          return {
            id: m.id as string,
            displayLabel: (m.displayLabel ?? '') as string,
            birthYear: (m.birthYear ?? null) as number | null,
            sex: (m.sex ?? null) as string | null,
            relationship: m.relationship as string,
            governanceRoles: (m.governanceRoles ?? []) as string[],
            isResident: (m.isResident ?? true) as boolean,
          };
        }),
      };
      return profile;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — profile rarely changes during assessment
    retry: 1,
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
