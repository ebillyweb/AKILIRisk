import "server-only";

import { INTEGRATION_PROBE_TIMEOUT_MS } from "@/lib/admin/integration-probes";
import type { HealthStatus, ServiceHealth } from "@/lib/admin/operations-health";
import { prisma } from "@/lib/db";
import {
  getEnterpriseProvisionQueueCounts,
  isEnterpriseProvisionQueueEnabled,
  type EnterpriseProvisionQueueCounts,
} from "@/lib/queue/enterprise-provision-queue";
import { isRedisConfigured } from "@/lib/queue/redis-connection";

/** Firms in PROVISIONING longer than this are surfaced as stuck on ops. */
export const STUCK_PROVISIONING_THRESHOLD_MS = 10 * 60 * 1000;

export type ProvisioningOpsMetrics = {
  mode: "queue" | "legacy";
  jobCounts: EnterpriseProvisionQueueCounts | null;
  provisioningFirms: number;
  stuckProvisioningFirms: number;
  oldestProvisioningAt: string | null;
};

export type BackgroundJobsHealth = {
  redis: ServiceHealth;
  cronSecret: ServiceHealth;
  enterpriseProvision: ServiceHealth;
  metrics: ProvisioningOpsMetrics;
};

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} probe timed out after ${ms}ms`)),
      ms,
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sanitizeProbeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Probe failed";
  return raw
    .replace(/rediss?:\/\/[^\s"']+/gi, "redis://[redacted]")
    .replace(/password[=:]\S+/gi, "password=[redacted]")
    .slice(0, 240);
}

function resolveRedisSource(env: NodeJS.ProcessEnv = process.env): string {
  if (env.REDIS_URL?.trim()) return "REDIS_URL";
  if (
    env.UPSTASH_REDIS_REST_URL?.trim() &&
    env.UPSTASH_REDIS_REST_TOKEN?.trim()
  ) {
    return "Upstash (Vercel integration)";
  }
  if (env.KV_REST_API_URL?.trim() && env.KV_REST_API_TOKEN?.trim()) {
    return "KV REST (legacy Vercel KV)";
  }
  return "not configured";
}

export async function probeRedisQueueBackend(): Promise<ServiceHealth> {
  const configured = isRedisConfigured();
  if (!configured) {
    return {
      id: "redis",
      label: "Redis (Upstash)",
      description: "BullMQ queue backend for async enterprise provisioning",
      configured: false,
      status: "unknown",
      detail:
        "Not configured — enterprise provisioning uses the legacy HTTP worker.",
    };
  }

  const source = resolveRedisSource();
  const start = Date.now();
  const probedAt = new Date().toISOString();

  try {
    const counts = await withTimeout(
      getEnterpriseProvisionQueueCounts(),
      INTEGRATION_PROBE_TIMEOUT_MS,
      "Redis",
    );
    const rttMs = Date.now() - start;
    const countSummary = counts
      ? `Queue depth: ${counts.waiting} waiting, ${counts.active} active, ${counts.failed} failed.`
      : "Connected.";

    return {
      id: "redis",
      label: "Redis (Upstash)",
      description: "BullMQ queue backend for async enterprise provisioning",
      configured: true,
      status: rttMs > 2000 ? "degraded" : "healthy",
      detail:
        rttMs > 2000
          ? `Responded in ${rttMs} ms (${source}). ${countSummary}`
          : `Responded in ${rttMs} ms via ${source}. ${countSummary}`,
      probedAt,
    };
  } catch (err) {
    return {
      id: "redis",
      label: "Redis (Upstash)",
      description: "BullMQ queue backend for async enterprise provisioning",
      configured: true,
      status: "down",
      detail: sanitizeProbeError(err),
      probedAt,
    };
  }
}

export function probeCronSecretForWorkers(): ServiceHealth {
  const configured = Boolean(process.env.CRON_SECRET?.trim());
  return {
    id: "cron-secret",
    label: "Worker auth (CRON_SECRET)",
    description:
      "Bearer token for /api/workers/enterprise-provision and provision cron",
    configured,
    status: configured ? "healthy" : "degraded",
    detail: configured
      ? "CRON_SECRET is set — worker wake and cron routes can authenticate."
      : "CRON_SECRET is not set — queue jobs rely on the 5-minute cron sweep only.",
  };
}

async function loadProvisioningFirmMetrics(): Promise<{
  provisioningFirms: number;
  stuckProvisioningFirms: number;
  oldestProvisioningAt: string | null;
}> {
  try {
    const stuckBefore = new Date(Date.now() - STUCK_PROVISIONING_THRESHOLD_MS);
    const [provisioningFirms, stuckProvisioningFirms, oldest] = await Promise.all([
      prisma.advisorEnterprise.count({ where: { status: "PROVISIONING" } }),
      prisma.advisorEnterprise.count({
        where: {
          status: "PROVISIONING",
          createdAt: { lt: stuckBefore },
        },
      }),
      prisma.advisorEnterprise.findFirst({
        where: { status: "PROVISIONING" },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    return {
      provisioningFirms,
      stuckProvisioningFirms,
      oldestProvisioningAt: oldest?.createdAt.toISOString() ?? null,
    };
  } catch {
    return {
      provisioningFirms: 0,
      stuckProvisioningFirms: 0,
      oldestProvisioningAt: null,
    };
  }
}

/** @internal Testable rollup for enterprise provision row status. */
export function resolveEnterpriseProvisionHealth(input: {
  mode: "queue" | "legacy";
  redisStatus: HealthStatus;
  cronConfigured: boolean;
  jobCounts: EnterpriseProvisionQueueCounts | null;
  provisioningFirms: number;
  stuckProvisioningFirms: number;
}): Pick<ServiceHealth, "status" | "detail"> {
  const {
    mode,
    redisStatus,
    cronConfigured,
    jobCounts,
    provisioningFirms,
    stuckProvisioningFirms,
  } = input;

  const parts: string[] = [];
  parts.push(
    mode === "queue"
      ? "Mode: BullMQ queue (Redis)."
      : "Mode: legacy HTTP worker (no Redis).",
  );

  if (jobCounts) {
    parts.push(
      `Jobs — waiting: ${jobCounts.waiting}, active: ${jobCounts.active}, delayed: ${jobCounts.delayed}, failed: ${jobCounts.failed}.`,
    );
  }

  if (provisioningFirms > 0) {
    parts.push(
      `${provisioningFirms} firm${provisioningFirms === 1 ? "" : "s"} in PROVISIONING.`,
    );
  } else {
    parts.push("No firms currently in PROVISIONING.");
  }

  if (stuckProvisioningFirms > 0) {
    parts.push(
      `${stuckProvisioningFirms} stuck > ${STUCK_PROVISIONING_THRESHOLD_MS / 60_000} min — check worker logs or retry from admin.`,
    );
  }

  if (mode === "queue" && redisStatus === "down") {
    return { status: "down", detail: parts.join(" ") };
  }

  if (!cronConfigured && mode === "queue") {
    parts.push("Worker wake disabled without CRON_SECRET.");
  }

  if (stuckProvisioningFirms > 0 || (jobCounts?.failed ?? 0) > 0) {
    return { status: "degraded", detail: parts.join(" ") };
  }

  if (mode === "queue" && redisStatus === "degraded") {
    return { status: "degraded", detail: parts.join(" ") };
  }

  if (provisioningFirms > 0 && mode === "queue" && (jobCounts?.waiting ?? 0) > 0) {
    return { status: "healthy", detail: parts.join(" ") };
  }

  return { status: "healthy", detail: parts.join(" ") };
}

export async function getBackgroundJobsHealth(): Promise<BackgroundJobsHealth> {
  const mode = isEnterpriseProvisionQueueEnabled() ? "queue" : "legacy";
  const [redis, firmMetrics] = await Promise.all([
    probeRedisQueueBackend(),
    loadProvisioningFirmMetrics(),
  ]);
  const cronSecret = probeCronSecretForWorkers();

  const jobCounts =
    mode === "queue" && redis.status !== "down"
      ? await getEnterpriseProvisionQueueCounts().catch(() => null)
      : null;

  const enterpriseRollup = resolveEnterpriseProvisionHealth({
    mode,
    redisStatus: redis.status,
    cronConfigured: cronSecret.configured,
    jobCounts,
    provisioningFirms: firmMetrics.provisioningFirms,
    stuckProvisioningFirms: firmMetrics.stuckProvisioningFirms,
  });

  const enterpriseProvision: ServiceHealth = {
    id: "enterprise-provision",
    label: "Enterprise provisioning",
    description: "Async firm setup queue + PROVISIONING status sweep",
    configured: true,
    status: enterpriseRollup.status,
    detail: enterpriseRollup.detail,
    probedAt: new Date().toISOString(),
  };

  return {
    redis,
    cronSecret,
    enterpriseProvision,
    metrics: {
      mode,
      jobCounts,
      provisioningFirms: firmMetrics.provisioningFirms,
      stuckProvisioningFirms: firmMetrics.stuckProvisioningFirms,
      oldestProvisioningAt: firmMetrics.oldestProvisioningAt,
    },
  };
}
