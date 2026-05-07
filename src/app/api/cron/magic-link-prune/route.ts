import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";

/**
 * Magic-Link Token Prune Cron Endpoint
 *
 * Round-11 cleanup (NIT 4): MagicLinkToken rows accumulate forever
 * because nothing in the live application removes them after they're
 * consumed or expired. `invalidatePriorMagicLinkTokens(email)` only
 * deletes prior unexpired+unused tokens at issuance time. Once a
 * token is consumed (`used: true`) or expires past the 15-min TTL,
 * it stays in the table.
 *
 * Daily prune deletes:
 *   * Any token with `used: true` (single-use enforced — no value in
 *     keeping the consumed receipt; AUTH_MAGIC_LINK_SUCCESS audit row
 *     records the actual signin event).
 *   * Any token whose `expires` is more than 7 days in the past.
 *     7-day grace gives operators a window to debug a "my link doesn't
 *     work" report against the actual issued row before it's gone.
 *
 * Mirrors the auth shape of /api/cron/audit-log-retention:
 * Bearer secret in the Authorization header, compared with
 * timingSafeEqual, 401 on missing/invalid, 500 on missing
 * CRON_SECRET (fail closed).
 *
 * Audit-logs the deleted row count via SYSTEM_MAGIC_LINK_PRUNE so
 * admins can monitor table size over time.
 */

const PRUNE_GRACE_DAYS = 7;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error("CRON_SECRET environment variable is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid authorization header. Include 'Authorization: Bearer <CRON_SECRET>'",
        },
        { status: 401 }
      );
    }

    const providedSecret = authHeader.substring(7);
    const providedBuf = Buffer.from(providedSecret, "utf8");
    const expectedBuf = Buffer.from(expectedSecret, "utf8");
    if (
      providedBuf.length !== expectedBuf.length ||
      !timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return NextResponse.json(
        { error: "Invalid cron secret" },
        { status: 401 }
      );
    }

    const graceCutoff = new Date(
      Date.now() - PRUNE_GRACE_DAYS * 24 * 60 * 60 * 1000
    );

    const result = await prisma.magicLinkToken.deleteMany({
      where: {
        OR: [
          { used: true },
          { expires: { lt: graceCutoff } },
        ],
      },
    });

    // Fire-and-forget audit. writeAudit catches its own errors.
    void writeAudit({
      actor: { userId: null },
      action: AUDIT_ACTIONS.SYSTEM_MAGIC_LINK_PRUNE,
      entityType: "MagicLinkToken",
      entityId: null,
      metadata: {
        deletedCount: result.count,
        graceCutoff: graceCutoff.toISOString(),
        graceDays: PRUNE_GRACE_DAYS,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      graceCutoff: graceCutoff.toISOString(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in magic-link prune cron:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
