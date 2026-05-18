"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ControlCenterSnapshot } from "@/lib/admin/control-center-types";

const DEFAULT_POLL_MS = 30_000;

function resolvePollIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_ADMIN_CONTROL_CENTER_POLL_MS;
  if (!raw) return DEFAULT_POLL_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 10_000 ? parsed : DEFAULT_POLL_MS;
}

export type ControlCenterPollStatus = "idle" | "refreshing" | "error";

export function useControlCenterPolling(initial: ControlCenterSnapshot) {
  const pollMs = resolvePollIntervalMs();
  const [snapshot, setSnapshot] = useState(initial);
  const [status, setStatus] = useState<ControlCenterPollStatus>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    inFlightRef.current = true;
    setStatus((current) => (current === "error" ? "error" : "refreshing"));

    try {
      const response = await fetch("/api/admin/control-center", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as ControlCenterSnapshot;
      setSnapshot(data);
      setStatus("idle");
      setLastError(null); // Clear error on success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Control center refresh failed:', errorMessage);
      setLastError(errorMessage);
      setStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh();
    }, pollMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pollMs]); // Remove refresh from deps since it has no dependencies

  return { snapshot, status, lastError, refresh, pollMs };
}
