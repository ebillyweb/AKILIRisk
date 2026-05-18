import "server-only";

import { cache } from "@/lib/cache/memory-cache";
import { getControlCenterActivity } from "@/lib/admin/control-center-activity";
import { getControlCenterAlerts } from "@/lib/admin/control-center-alerts";
import { getControlCenterMetrics } from "@/lib/admin/control-center-metrics";
import { monitorPerformance } from "@/lib/monitoring/performance";
import type {
  ControlCenterActivity,
  ControlCenterAlert,
  ControlCenterMetrics,
  ControlCenterSnapshot,
} from "@/lib/admin/control-center-types";

// Cache keys for different data types
const CACHE_KEYS = {
  FULL_SNAPSHOT: "control-center:full-snapshot",
  METRICS: "control-center:metrics",
  ALERTS: "control-center:alerts",
  ACTIVITY: "control-center:activity",
} as const;

// Cache TTL in seconds
const CACHE_TTL = {
  METRICS: 5 * 60,    // 5 minutes - slower changing data
  ALERTS: 30,         // 30 seconds - time-sensitive
  ACTIVITY: 2 * 60,   // 2 minutes - medium priority
  FULL_SNAPSHOT: 30,  // 30 seconds - complete refresh
} as const;

/**
 * Get cached metrics with fallback to fresh data.
 */
async function getCachedMetrics(): Promise<ControlCenterMetrics> {
  const cached = await cache.get<ControlCenterMetrics>(CACHE_KEYS.METRICS);
  if (cached) return cached;

  const { result: metrics } = await monitorPerformance(
    "control-center-metrics",
    () => getControlCenterMetrics(),
    { cacheKey: CACHE_KEYS.METRICS }
  );

  await cache.set(CACHE_KEYS.METRICS, metrics, CACHE_TTL.METRICS);
  return metrics;
}

/**
 * Get cached alerts with fallback to fresh data.
 */
async function getCachedAlerts(): Promise<ControlCenterAlert[]> {
  const cached = await cache.get<ControlCenterAlert[]>(CACHE_KEYS.ALERTS);
  if (cached) return cached;

  const { result: alerts } = await monitorPerformance(
    "control-center-alerts",
    () => getControlCenterAlerts(),
    { cacheKey: CACHE_KEYS.ALERTS }
  );

  await cache.set(CACHE_KEYS.ALERTS, alerts, CACHE_TTL.ALERTS);
  return alerts;
}

/**
 * Get cached activity with fallback to fresh data.
 */
async function getCachedActivity(): Promise<ControlCenterActivity[] | null> {
  const cached = await cache.get<ControlCenterActivity[] | null>(CACHE_KEYS.ACTIVITY);
  if (cached) return cached;

  const { result: activity } = await monitorPerformance(
    "control-center-activity",
    () => getControlCenterActivity(),
    { cacheKey: CACHE_KEYS.ACTIVITY }
  );

  await cache.set(CACHE_KEYS.ACTIVITY, activity, CACHE_TTL.ACTIVITY);
  return activity;
}

/**
 * Get control center snapshot with intelligent caching.
 * Each data type has its own cache TTL based on update frequency needs.
 */
export async function getCachedControlCenterSnapshot(): Promise<ControlCenterSnapshot> {
  return await monitorPerformance(
    "control-center-full-snapshot",
    async () => {
      // Try full snapshot cache first (fastest path)
      const cachedSnapshot = await cache.get<ControlCenterSnapshot>(CACHE_KEYS.FULL_SNAPSHOT);
      if (cachedSnapshot) {
        console.log('Control center snapshot served from cache');
        return cachedSnapshot;
      }

      // Generate fresh snapshot with individual component caching
      const [metricsResult, alertsResult, activityResult] = await Promise.allSettled([
        getCachedMetrics(),
        getCachedAlerts(),
        getCachedActivity(),
      ]);

      const snapshot: ControlCenterSnapshot = {
        generatedAt: new Date().toISOString(),
        metrics: metricsResult.status === "fulfilled" ? metricsResult.value : null,
        alerts: alertsResult.status === "fulfilled" ? alertsResult.value : null,
        activity: activityResult.status === "fulfilled" ? activityResult.value : null,
      };

      // Cache the full snapshot
      await cache.set(CACHE_KEYS.FULL_SNAPSHOT, snapshot, CACHE_TTL.FULL_SNAPSHOT);

      console.log('Control center snapshot generated fresh');
      return snapshot;
    },
    {
      cacheKey: CACHE_KEYS.FULL_SNAPSHOT,
      componentsCount: 3
    }
  ).then(result => result.result);
}

/**
 * Invalidate specific cache keys (for use after data mutations).
 */
export async function invalidateControlCenterCache(keys?: (keyof typeof CACHE_KEYS)[]): Promise<void> {
  if (!keys) {
    // Invalidate all control center cache
    await Promise.all([
      cache.delete(CACHE_KEYS.FULL_SNAPSHOT),
      cache.delete(CACHE_KEYS.METRICS),
      cache.delete(CACHE_KEYS.ALERTS),
      cache.delete(CACHE_KEYS.ACTIVITY),
    ]);
  } else {
    // Invalidate specific keys
    await Promise.all(
      keys.map(key => cache.delete(CACHE_KEYS[key]))
    );
  }
}

/**
 * Get cache statistics for monitoring.
 */
export function getControlCenterCacheStats() {
  return {
    totalCacheSize: cache.size(),
    cacheKeys: Object.values(CACHE_KEYS),
    ttlSettings: CACHE_TTL,
  };
}