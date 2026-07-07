"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import {
  AUTH_SESSION_SYNC_CHANNEL,
  AUTH_SESSION_SYNC_STORAGE_KEY,
  shouldRefreshSessionShell,
} from "@/lib/auth/session-sync";

interface SessionSyncProps {
  /** User id from the server-rendered session; refreshed when the cookie changes. */
  userId: string;
}

const MIN_REFRESH_INTERVAL_MS = 2000;

/**
 * Reconciles stale RSC shells when another tab signs in or out (one JWT cookie per origin).
 */
export function SessionSync({ userId }: SessionSyncProps) {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    function scheduleRefresh() {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < MIN_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshAtRef.current = now;
      router.refresh();
    }

    async function reconcileSession() {
      const session = await getSession();
      const liveUserId = session?.user?.id;

      if (cancelled) return;
      if (shouldRefreshSessionShell(userId, liveUserId)) {
        scheduleRefresh();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void reconcileSession();
      }
    }

    function onStorage(event: StorageEvent) {
      if (event.key === AUTH_SESSION_SYNC_STORAGE_KEY) {
        void reconcileSession();
      }
    }

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(AUTH_SESSION_SYNC_CHANNEL);
      channel.onmessage = () => {
        void reconcileSession();
      };
    } catch {
      // BroadcastChannel unavailable — storage + visibility still apply.
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [userId, router]);

  return null;
}
