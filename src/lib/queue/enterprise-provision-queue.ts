import "server-only";

import { Queue, Worker, type Job } from "bullmq";

import { logSafeError } from "@/lib/log-safe-error";
import type { EnterpriseProvisionActor } from "@/lib/enterprise/provision-types";
import { finalizeEnterpriseProvision } from "@/lib/enterprise/finalize-enterprise-provision";

import { getBullMqConnection, isRedisConfigured } from "./redis-connection";

export const ENTERPRISE_PROVISION_QUEUE = "enterprise-provision";
const ENTERPRISE_PROVISION_JOB_NAME = "finalize";

export type EnterpriseProvisionJobData = {
  enterpriseId: string;
  actor?: EnterpriseProvisionActor;
};

export type EnterpriseProvisionQueueCounts = {
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
};

export function enterpriseProvisionJobId(enterpriseId: string): string {
  return `provision:${enterpriseId}`;
}

export function isEnterpriseProvisionQueueEnabled(): boolean {
  return isRedisConfigured();
}

async function runProvisionJob(job: Job<EnterpriseProvisionJobData>) {
  const result = await finalizeEnterpriseProvision(
    job.data.enterpriseId,
    job.data.actor,
  );
  if (!result.success && !result.skipped) {
    throw new Error(result.error ?? "Provision finalize failed");
  }
  return result;
}

export async function getEnterpriseProvisionQueueCounts(): Promise<EnterpriseProvisionQueueCounts | null> {
  if (!isEnterpriseProvisionQueueEnabled()) return null;

  const connection = getBullMqConnection();
  const queue = new Queue<EnterpriseProvisionJobData>(ENTERPRISE_PROVISION_QUEUE, {
    connection,
  });

  try {
    const counts = await queue.getJobCounts(
      "waiting",
      "active",
      "delayed",
      "failed",
      "completed",
    );
    return {
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
    };
  } finally {
    await queue.close();
  }
}

export async function enqueueEnterpriseProvisionJob(
  enterpriseId: string,
  actor?: EnterpriseProvisionActor,
): Promise<{ jobId: string; enqueued: boolean }> {
  const connection = getBullMqConnection();
  const queue = new Queue<EnterpriseProvisionJobData>(ENTERPRISE_PROVISION_QUEUE, {
    connection,
  });

  const jobId = enterpriseProvisionJobId(enterpriseId);

  try {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === "active" || state === "waiting" || state === "delayed") {
        return { jobId, enqueued: false };
      }
    }

    await queue.add(
      ENTERPRISE_PROVISION_JOB_NAME,
      { enterpriseId, actor },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    );

    return { jobId, enqueued: true };
  } finally {
    await queue.close();
  }
}

/**
 * Serverless-friendly drain: process up to `maxJobs` within a time budget,
 * then close connections (no long-running worker process).
 */
export async function drainEnterpriseProvisionQueue(options?: {
  maxJobs?: number;
  maxDurationMs?: number;
}): Promise<{ processed: number; failed: number }> {
  const maxJobs = options?.maxJobs ?? 5;
  const maxDurationMs = options?.maxDurationMs ?? 240_000;
  const connection = getBullMqConnection();
  const worker = new Worker<EnterpriseProvisionJobData>(
    ENTERPRISE_PROVISION_QUEUE,
    runProvisionJob,
    {
      connection,
      autorun: false,
      lockDuration: 300_000,
      concurrency: 1,
    },
  );

  let processed = 0;
  let failed = 0;
  const deadline = Date.now() + maxDurationMs;

  try {
    while (processed + failed < maxJobs && Date.now() < deadline) {
      const token = `drain-${Date.now()}-${processed + failed}`;
      const job = await worker.getNextJob(token);
      if (!job) break;

      try {
        await worker.processJob(job, token);
        processed += 1;
      } catch (error) {
        failed += 1;
        logSafeError(`enterprise/provision:job:${job.id}`, error);
      }
    }
  } finally {
    await worker.close();
  }

  return { processed, failed };
}
