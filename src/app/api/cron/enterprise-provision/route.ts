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

    let queue: { processed: number; failed: number } | null = null;
    if (isEnterpriseProvisionQueueEnabled()) {
      queue = await drainEnterpriseProvisionQueue({ maxJobs: 10, maxDurationMs: 240_000 });
    }

    const legacy = await processPendingEnterpriseProvisions({ limit: 10 });

    return NextResponse.json({
      success: true,
      mode: isEnterpriseProvisionQueueEnabled() ? "queue" : "legacy",
      queue,
      ...legacy,
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
