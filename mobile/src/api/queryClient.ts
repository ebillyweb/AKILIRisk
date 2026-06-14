import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.isAuthError) return false;
        return failureCount < 2;
      },
    },
  },
});

export const queryKeys = {
  intakeScript: ['intake', 'script'] as const,
  advisorClients: ['advisor', 'clients'] as const,
  clientIntake: (id: string) => ['advisor', 'client', id] as const,
};
