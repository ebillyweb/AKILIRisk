import "server-only";

import { logSafeError } from "@/lib/log-safe-error";
import { getPublicAppUrlFromEnv } from "@/lib/public-app-url";

/** Nudge the serverless worker route to drain the BullMQ queue. */
export async function wakeEnterpriseProvisionWorker(): Promise<void> {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.warn(
      "wakeEnterpriseProvisionWorker: CRON_SECRET not set; worker will rely on cron",
    );
    return;
  }

  const baseUrl = getPublicAppUrlFromEnv();
  try {
    const response = await fetch(`${baseUrl}/api/workers/enterprise-provision`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Worker wake returned ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
  } catch (error) {
    logSafeError("enterprise/provision:wake-worker", error);
  }
}
