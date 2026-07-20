import { NextRequest, NextResponse } from "next/server";

import { verifyCronSecretRequest } from "@/lib/cron/verify-cron-secret";
import { processPendingEnterpriseProvisions } from "@/lib/enterprise/finalize-enterprise-provision";
import {
  drainEnterpriseProvisionQueue,
  isEnterpriseProvisionQueueEnabled,
} from "@/lib/queue/enterprise-provision-queue";

/**
 * Retries enterprise firms stuck in PROVISIONING.
 * Drains BullMQ when REDIS_URL is set, then sweeps any remaining PROVISIONING rows.
 *
 * GET /api/cron/enterprise-provision
 * Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronSecretRequest(request.headers.get("Authorization"));
    if (authError) return authError;

    // Only sweep PROVISIONING rows directly when BullMQ isn't configured —
    // otherwise the queue drain's job lock is the concurrency guard and a
    // parallel sweep would bypass it (double-finalize).
    const queueEnabled = isEnterpriseProvisionQueueEnabled();
    let queue: { processed: number; failed: number } | null = null;
    let legacy: Awaited<
      ReturnType<typeof processPendingEnterpriseProvisions>
    > | null = null;
    if (queueEnabled) {
      queue = await drainEnterpriseProvisionQueue({ maxJobs: 10, maxDurationMs: 240_000 });
    } else {
      legacy = await processPendingEnterpriseProvisions({ limit: 10 });
    }

    return NextResponse.json({
      success: true,
      mode: queueEnabled ? "queue" : "legacy",
      queue,
      ...(legacy ?? {}),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Enterprise provision cron error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
