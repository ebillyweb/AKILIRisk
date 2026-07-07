import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { buildExecutiveReportSnapshot } from "@/lib/pdf/build-executive-report-snapshot";

/**
 * Phase 25: Scheduled executive report draft generation (D-20, D-21).
 *
 * Runs on a schedule to create DRAFT rows for clients with approaching
 * ReviewCadence due dates (within 7 days). Advisors review and explicitly
 * publish — scheduled reports are NEVER auto-distributed (D-21).
 *
 * Security: CRON_SECRET Bearer token auth with timingSafeEqual (T-25-11).
 * Idempotent: skips (client, advisor) pairs that already have a DRAFT (T-25-12).
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Validate cron secret (T-25-11).
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error(
        "[executive-report-drafts] CRON_SECRET environment variable is not configured"
      );
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

    // 2. Find approaching cadences (nextDueDate within 7 days).
    const startTime = Date.now();
    const now = new Date();
    const windowEnd = addDays(now, 7);

    const approachingCadences = await prisma.reviewCadence.findMany({
      where: {
        nextDueDate: { gte: now, lte: windowEnd },
        // Only process cadences tied to a completed assessment.
        lastAssessmentId: { not: null },
      },
      select: {
        id: true,
        clientId: true,
        advisorProfileId: true,
        nextDueDate: true,
        frequency: true,
        lastAssessmentId: true,
      },
    });

    console.log(
      `[executive-report-drafts] Found ${approachingCadences.length} approaching cadences`
    );

    let draftsCreated = 0;
    let skipped = 0;

    for (const cadence of approachingCadences) {
      try {
        // Idempotent: skip if a DRAFT already exists for this (client, advisor) pair (T-25-12).
        const existingDraft = await prisma.executiveReport.findFirst({
          where: {
            clientId: cadence.clientId,
            advisorProfileId: cadence.advisorProfileId,
            status: "DRAFT",
          },
          select: { id: true },
        });

        if (existingDraft) {
          console.log(
            `[executive-report-drafts] Skipping clientId=${cadence.clientId} advisorProfileId=${cadence.advisorProfileId} — DRAFT already exists`
          );
          skipped++;
          continue;
        }

        // Determine reporting period (D-22).
        const periodEnd = now;
        let periodStart: Date;

        const lastPublished = await prisma.executiveReport.findFirst({
          where: {
            clientId: cadence.clientId,
            advisorProfileId: cadence.advisorProfileId,
            status: "PUBLISHED",
          },
          orderBy: { publishedAt: "desc" },
          select: { reportingPeriodEnd: true },
        });

        if (lastPublished) {
          periodStart = lastPublished.reportingPeriodEnd;
        } else {
          // First-ever report: cover all time from earliest assessment.
          const earliest = await prisma.assessment.findFirst({
            where: { userId: cadence.clientId },
            orderBy: { startedAt: "asc" },
            select: { startedAt: true },
          });
          periodStart = earliest?.startedAt ?? new Date(0);
        }

        // Determine next version.
        const latest = await prisma.executiveReport.findFirst({
          where: {
            clientId: cadence.clientId,
            advisorProfileId: cadence.advisorProfileId,
          },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const nextVersion = (latest?.version ?? 0) + 1;

        // Build snapshot for advisor preview (D-21: advisor reviews before publish).
        const snapshot = await buildExecutiveReportSnapshot(
          cadence.clientId,
          cadence.advisorProfileId,
          { periodStart, periodEnd }
        );

        // Create the DRAFT row with pre-populated snapshot (D-21).
        await prisma.executiveReport.create({
          data: {
            clientId: cadence.clientId,
            advisorProfileId: cadence.advisorProfileId,
            version: nextVersion,
            status: "DRAFT",
            reportingPeriodStart: periodStart,
            reportingPeriodEnd: periodEnd,
            // Pre-populate snapshot so advisor can preview immediately.
            // This is overwritten at publish time with a fresh snapshot.
            executiveSnapshotData: snapshot as unknown as import("@prisma/client").Prisma.InputJsonValue,
          },
        });

        console.log(
          `[executive-report-drafts] Created DRAFT v${nextVersion} for clientId=${cadence.clientId} advisorProfileId=${cadence.advisorProfileId} (cadenceId=${cadence.id})`
        );
        draftsCreated++;
      } catch (err) {
        // Log per-cadence errors but continue processing others.
        console.error(
          `[executive-report-drafts] Error processing cadenceId=${cadence.id}:`,
          err
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[executive-report-drafts] Done: processed=${approachingCadences.length} draftsCreated=${draftsCreated} skipped=${skipped} durationMs=${duration}`
    );

    return NextResponse.json({
      success: true,
      processed: approachingCadences.length,
      draftsCreated,
      skipped,
      processingTimeMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[executive-report-drafts] Fatal error:", error);
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
