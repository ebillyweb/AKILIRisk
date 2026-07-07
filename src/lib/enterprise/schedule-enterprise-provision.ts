import "server-only";

import { logSafeError } from "@/lib/log-safe-error";
import { scheduleAfterResponse } from "@/lib/server/schedule-after-response";
import type { EnterpriseProvisionActor } from "@/lib/enterprise/provision-types";
import { finalizeEnterpriseProvision } from "@/lib/enterprise/finalize-enterprise-provision";
import {
  enqueueEnterpriseProvisionJob,
  isEnterpriseProvisionQueueEnabled,
} from "@/lib/queue/enterprise-provision-queue";
import { wakeEnterpriseProvisionWorker } from "@/lib/queue/wake-enterprise-provision-worker";
import { getPublicAppUrlFromEnv } from "@/lib/public-app-url";

export type { EnterpriseProvisionActor } from "@/lib/enterprise/provision-types";

async function finalizeAndLog(
  enterpriseId: string,
  actor?: EnterpriseProvisionActor,
): Promise<void> {
  const result = await finalizeEnterpriseProvision(enterpriseId, actor);
  if (!result.success && !result.skipped) {
    logSafeError(
      `enterprise/provision:${enterpriseId}`,
      new Error(result.error ?? "Provision finalize failed"),
    );
  }
}

async function triggerProvisionHttp(
  enterpriseId: string,
  actorUserId?: string,
): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    throw new Error("CRON_SECRET is not configured");
  }

  const baseUrl = getPublicAppUrlFromEnv();
  const response = await fetch(
    `${baseUrl}/api/internal/enterprise-provision/${enterpriseId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ actorUserId: actorUserId ?? null }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Provision worker returned ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }
}

async function runLegacyProvisionTrigger(
  enterpriseId: string,
  actor?: EnterpriseProvisionActor,
): Promise<void> {
  try {
    await triggerProvisionHttp(enterpriseId, actor?.userId);
  } catch (httpError) {
    logSafeError(`enterprise/provision:http:${enterpriseId}`, httpError);
    await finalizeAndLog(enterpriseId, actor);
  }
}

/**
 * Queue enterprise setup after the admin form returns. Uses BullMQ + Redis when
 * configured; otherwise falls back to the internal HTTP worker route.
 */
export function scheduleEnterpriseProvision(
  enterpriseId: string,
  actor?: EnterpriseProvisionActor,
): void {
  scheduleAfterResponse(async () => {
    if (isEnterpriseProvisionQueueEnabled()) {
      try {
        await enqueueEnterpriseProvisionJob(enterpriseId, actor);
        await wakeEnterpriseProvisionWorker();
        return;
      } catch (queueError) {
        logSafeError(`enterprise/provision:enqueue:${enterpriseId}`, queueError);
      }
    }

    await runLegacyProvisionTrigger(enterpriseId, actor);
  });
}

/** Admin retry or ops tooling — enqueue without waiting for completion. */
export async function queueEnterpriseProvision(
  enterpriseId: string,
  actor?: EnterpriseProvisionActor,
): Promise<{ queued: boolean; mode: "queue" | "legacy" }> {
  if (isEnterpriseProvisionQueueEnabled()) {
    await enqueueEnterpriseProvisionJob(enterpriseId, actor);
    await wakeEnterpriseProvisionWorker();
    return { queued: true, mode: "queue" };
  }

  await runLegacyProvisionTrigger(enterpriseId, actor);
  return { queued: true, mode: "legacy" };
}
