import { useQuery } from '@tanstack/react-query';
import { fetchIntakeScript } from '@/api/intake';
import { queryKeys } from '@/api/queryClient';

export function useIntakeScript() {
  return useQuery({
    queryKey: queryKeys.intakeScript,
    queryFn: fetchIntakeScript,
  });
}
