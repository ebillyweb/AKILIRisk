import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import {
  getOverdueCadences,
  getDueSoonCadences,
} from "@/lib/cadence/review-cadence";
import { checkSystemReassessmentTriggers } from "@/lib/cadence/system-triggers";
import {
  INTELLIGENCE_ACTIONS,
  logIntelligenceEvent,
} from "@/lib/engagement/intelligence-events";

/**
 * Phase 24 Review Cadence Engine cron route (D-10).
 *
 * Runs daily to:
 * 1. Find overdue cadences and log CADENCE_OVERDUE events
 * 2. Find due-soon cadences and log CADENCE_DUE_APPROACHING events
 * 3. Check system reassessment triggers for each cadence
 *
 * Security: CRON_SECRET Bearer token auth (same pattern as
 * advisory-outreach-reminder). Dedup via lastReminderSentAt (Pitfall 5).
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Validate cron secret.
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error("CRON_SECRET environment variable is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      );
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid authorization header. Include 'Authorization: Bearer <CRON_SECRET>'",
        },
        { status: 401 },
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
        { status: 401 },
      );
    }

    // 2. Process cadences.
    const startTime = Date.now();
    const now = new Date();

    // 2a. Overdue cadences
    const overdueCadences = await getOverdueCadences();
    for (const cadence of overdueCadences) {
      await logIntelligenceEvent({
        action: INTELLIGENCE_ACTIONS.CADENCE_OVERDUE,
        assessmentId: cadence.lastAssessmentId ?? undefined,
        detail: {
          clientId: cadence.clientId,
          advisorProfileId: cadence.advisorProfileId,
          nextDueDate: cadence.nextDueDate.toISOString(),
          frequency: cadence.frequency,
        },
      });

      // Update lastReminderSentAt for dedup (Pitfall 5)
      await prisma.reviewCadence.update({
        where: { id: cadence.id },
        data: { lastReminderSentAt: now },
      });
    }

    // 2b. Due-soon cadences
    const dueSoonCadences = await getDueSoonCadences();
    for (const cadence of dueSoonCadences) {
      await logIntelligenceEvent({
        action: INTELLIGENCE_ACTIONS.CADENCE_DUE_APPROACHING,
        assessmentId: cadence.lastAssessmentId ?? undefined,
        detail: {
          clientId: cadence.clientId,
          advisorProfileId: cadence.advisorProfileId,
          nextDueDate: cadence.nextDueDate.toISOString(),
          frequency: cadence.frequency,
        },
      });

      // Update lastReminderSentAt for dedup
      await prisma.reviewCadence.update({
        where: { id: cadence.id },
        data: { lastReminderSentAt: now },
      });
    }

    // 2c. System reassessment triggers (D-09)
    // Check all cadences with a lastAssessmentId
    const allCadencesWithAssessment = [
      ...overdueCadences,
      ...dueSoonCadences,
    ].filter((c) => c.lastAssessmentId);

    // Deduplicate by clientId+assessmentId to avoid checking the same pair twice
    const checked = new Set<string>();
    let systemRecommendedCount = 0;

    for (const cadence of allCadencesWithAssessment) {
      const key = `${cadence.clientId}:${cadence.lastAssessmentId}`;
      if (checked.has(key)) continue;
      checked.add(key);

      const result = await checkSystemReassessmentTriggers(
        cadence.clientId,
        cadence.lastAssessmentId!,
      );

      if (result.shouldRecommend) {
        await prisma.reviewCadence.update({
          where: { id: cadence.id },
          data: {
            systemRecommended: true,
            systemRecommendationReason: result.reason,
          },
        });

        await logIntelligenceEvent({
          action: INTELLIGENCE_ACTIONS.CADENCE_SYSTEM_RECOMMENDED,
          assessmentId: cadence.lastAssessmentId ?? undefined,
          detail: {
            clientId: cadence.clientId,
            reason: result.reason,
          },
        });

        systemRecommendedCount++;
      }
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      overdueCount: overdueCadences.length,
      dueSoonCount: dueSoonCadences.length,
      systemRecommendedCount,
      processingTimeMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in review-cadence cron:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
