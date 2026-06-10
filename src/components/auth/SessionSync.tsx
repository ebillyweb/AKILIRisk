"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "next-auth/react";
import {
  AUTH_SESSION_SYNC_CHANNEL,
  AUTH_SESSION_SYNC_STORAGE_KEY,
} from "@/lib/auth/session-sync";

interface SessionSyncProps {
  /** User id from the server-rendered session; refreshed when the cookie changes. */
  userId: string;
}

/**
 * Reconciles stale RSC shells when another tab signs in or out (one JWT cookie per origin).
 */
export function SessionSync({ userId }: SessionSyncProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function reconcileSession() {
      const session = await getSession();
      const liveUserId = session?.user?.id;

      if (cancelled) return;
      if (!liveUserId || liveUserId !== userId) {
        router.refresh();
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
      // BroadcastChannel unavailable — storage + focus still apply.
    }

    window.addEventListener("focus", reconcileSession);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", reconcileSession);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [userId, router]);

  return null;
}
