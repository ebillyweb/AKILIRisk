import "server-only";

import { getControlCenterActivity } from "@/lib/admin/control-center-activity";
import { getControlCenterAlerts } from "@/lib/admin/control-center-alerts";
import { getControlCenterMetrics } from "@/lib/admin/control-center-metrics";
import type { ControlCenterSnapshot } from "@/lib/admin/control-center-types";

export type { ControlCenterSnapshot } from "@/lib/admin/control-center-types";

/**
 * Single bundle for `/admin` live data (SSR + polling API).
 * Each query is isolated via `Promise.allSettled` so one failure
 * does not block the others.
 */
export async function getControlCenterSnapshot(): Promise<ControlCenterSnapshot> {
  const [metricsResult, alertsResult, activityResult] = await Promise.allSettled([
    getControlCenterMetrics(),
    getControlCenterAlerts(),
    getControlCenterActivity(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    metrics:
      metricsResult.status === "fulfilled" ? metricsResult.value : null,
    alerts: alertsResult.status === "fulfilled" ? alertsResult.value : null,
    activity:
      activityResult.status === "fulfilled" ? activityResult.value : null,
  };
}
