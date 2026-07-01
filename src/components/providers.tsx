'use client';

import type { Session } from "next-auth";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

import { ThemeProvider } from '@/components/theme/ThemeProvider';

/**
 * Application Providers
 *
 * Wraps the app with TanStack Query and toast notifications.
 */

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
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
    // SessionProvider only reads its `session` prop on mount, so a server-action
    // sign-out (soft RSC navigation) would leave useSession() stale. Keying by the
    // server session's user id remounts it whenever auth state actually changes.
    <SessionProvider
      key={session?.user?.id ?? "unauthenticated"}
      session={session}
      refetchOnWindowFocus
    >
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
    </SessionProvider>
  );
}
