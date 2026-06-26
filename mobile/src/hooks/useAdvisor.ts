import { useQuery } from '@tanstack/react-query';
import { fetchAdvisorClients, fetchClientIntake } from '@/api/advisor';
import { queryKeys } from '@/api/queryClient';

export function useAdvisorClients() {
  return useQuery({
    queryKey: queryKeys.advisorClients,
    queryFn: fetchAdvisorClients,
  });
}

export function useClientIntake(clientId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.clientIntake(clientId ?? ''),
    queryFn: () => fetchClientIntake(clientId as string),
    enabled: Boolean(clientId),
  });
}
