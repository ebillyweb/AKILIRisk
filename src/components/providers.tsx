'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

import { ThemeProvider } from '@/components/theme/ThemeProvider';

/**
 * Application Providers
 *
 * Wraps the app with TanStack Query and toast notifications.
 */

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: "1rem",
              border: "1px solid color-mix(in oklab, var(--border) 78%, transparent 22%)",
              background: "color-mix(in oklab, var(--card) 96%, var(--background) 4%)",
              color: "var(--foreground)",
              boxShadow:
                "0 24px 60px -40px color-mix(in oklab, var(--foreground) 18%, transparent 82%)",
              backdropFilter: "blur(18px)",
            },
            success: {
              iconTheme: {
                primary: "var(--primary)",
                secondary: "var(--primary-foreground)",
              },
            },
            error: {
              iconTheme: {
                primary: "var(--destructive)",
                secondary: "var(--primary-foreground)",
              },
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
