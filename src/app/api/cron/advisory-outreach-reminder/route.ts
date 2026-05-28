import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { triggerAdvisoryOutreachReminder } from "@/lib/notifications/deliverable-phase-triggers";

/**
 * BRD §6.3 / Epic 5.10 US-71 — Advisory-team SLA reminder cron.
 *
 * Fires the 44-hour pre-SLA nudge to assigned advisors for every
 * assessment still sitting in PREVIEW that has been there longer than 44
 * hours. The trigger itself (in deliverable-phase-triggers.ts) re-checks
 * the phase under the assumption a transition to PROFILE may race with
 * the cron run.
 *
 * Security: requires the CRON_SECRET env var in the Authorization
 * header (per BR-35 / US-54). Pattern matches the document-reminders
 * route: equal-length precheck plus a timing-safe comparison.
 *
 * Dedup: this slice fires daily for any assessment still in PREVIEW
 * past 44 hours. If reminder fatigue becomes a concern, add an
 * `slaReminderSentAt` column on Assessment and exclude rows where it
 * is non-null on subsequent runs.
 */
const FORTY_FOUR_HOURS_MS = 44 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    // 1. Validate cron secret.
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

    // 2. Find candidates — every assessment still in PREVIEW where
    //    previewEnteredAt + 44h is already in the past.
    const startTime = Date.now();
    const threshold = new Date(Date.now() - FORTY_FOUR_HOURS_MS);

    const stuck = await prisma.assessment.findMany({
      where: {
        deliverablePhase: "PREVIEW",
        previewEnteredAt: { lte: threshold, not: null },
      },
      select: { id: true },
    });

    // 3. Dispatch reminders. Each trigger is fire-and-forget on the
    //    notification side, but we still await so the cron run reports an
    //    accurate count of attempts (the trigger swallows internal errors).
    let attempted = 0;
    for (const a of stuck) {
      await triggerAdvisoryOutreachReminder(a.id);
      attempted += 1;
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      assessmentsConsidered: stuck.length,
      remindersAttempted: attempted,
      processingTimeMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in advisory-outreach-reminder cron:", error);
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
