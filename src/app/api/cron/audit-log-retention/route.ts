import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runAuditLogRetentionSweep } from "@/lib/audit/retention";

/**
 * Audit-Log Retention Cron Endpoint
 *
 * Deletes AuditLog rows whose `createdAt` is older than the configured
 * retention window. Mirrors the auth shape of the other cron routes
 * (`/api/cron/workflow-reminders`, `/api/cron/document-reminders`):
 * Bearer secret in the Authorization header, compared with timingSafeEqual,
 * 401 on missing/invalid, 500 on missing CRON_SECRET (fail closed).
 *
 * The actual sweep + self-audit lives in src/lib/audit/retention.ts so the
 * logic can be unit-tested without standing up a NextRequest fixture.
 *
 * BRD §5.5 ("configurable retention policy") + the round-7 audit-log design.
 */

export async function GET(request: NextRequest) {
  try {
    // Validate cron secret (mirrors other cron routes for consistency).
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

    const result = await runAuditLogRetentionSweep();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in audit-log retention cron:", error);
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
