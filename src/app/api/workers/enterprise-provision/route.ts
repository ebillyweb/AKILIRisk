import { NextRequest, NextResponse } from "next/server";

import { verifyCronSecretRequest } from "@/lib/cron/verify-cron-secret";
import { processPendingEnterpriseProvisions } from "@/lib/enterprise/finalize-enterprise-provision";
import {
  drainEnterpriseProvisionQueue,
  isEnterpriseProvisionQueueEnabled,
} from "@/lib/queue/enterprise-provision-queue";

export const maxDuration = 300;

/**
 * Drains the BullMQ enterprise-provision queue (POC worker for Vercel).
 * Falls back to DB PROVISIONING sweep when Redis is not configured.
 *
 * POST /api/workers/enterprise-provision
 * Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  try {
    const authError = verifyCronSecretRequest(request.headers.get("Authorization"));
    if (authError) return authError;

    // BullMQ's job lock is the concurrency guard when the queue is enabled;
    // running the DB sweep alongside it would bypass that lock, so only sweep
    // when Redis isn't configured (the sweep is then the sole finalize path).
    const queueEnabled = isEnterpriseProvisionQueueEnabled();
    let queueResult: { processed: number; failed: number } | null = null;
    let legacy: Awaited<
      ReturnType<typeof processPendingEnterpriseProvisions>
    > | null = null;
    if (queueEnabled) {
      queueResult = await drainEnterpriseProvisionQueue({
        maxJobs: 5,
        maxDurationMs: 240_000,
      });
    } else {
      legacy = await processPendingEnterpriseProvisions({ limit: 5 });
    }

    return NextResponse.json({
      success: true,
      mode: queueEnabled ? "queue" : "legacy",
      queue: queueResult,
      legacy,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Enterprise provision worker error:", error);
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
