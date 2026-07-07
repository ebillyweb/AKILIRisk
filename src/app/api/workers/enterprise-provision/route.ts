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

    let queueResult: { processed: number; failed: number } | null = null;
    if (isEnterpriseProvisionQueueEnabled()) {
      queueResult = await drainEnterpriseProvisionQueue({
        maxJobs: 5,
        maxDurationMs: 240_000,
      });
    }

    const legacy = await processPendingEnterpriseProvisions({ limit: 5 });

    return NextResponse.json({
      success: true,
      mode: isEnterpriseProvisionQueueEnabled() ? "queue" : "legacy",
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
