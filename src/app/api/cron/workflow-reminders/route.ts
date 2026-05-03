import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processAssessmentReminders } from "@/lib/reminders/assessment-reminders";
import { processWorkflowReminders } from "@/lib/reminders/workflow-reminders";

/**
 * Workflow Reminder Cron Endpoint
 *
 * GET: Process and send workflow stall notifications and assessment reminders
 *
 * Security: Requires CRON_SECRET environment variable in Authorization header
 * Usage: Can be triggered by Vercel Cron, external cron service, or manual curl
 *
 * Example curl:
 * curl -H "Authorization: Bearer your-secret-here" https://yourapp.vercel.app/api/cron/workflow-reminders
 */

export async function GET(request: NextRequest) {
  try {
    // 1. Validate cron secret
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
        { error: "Missing or invalid authorization header. Include 'Authorization: Bearer <CRON_SECRET>'" },
        { status: 401 }
      );
    }

    const providedSecret = authHeader.substring(7); // Remove "Bearer "
    // Constant-time comparison so a network attacker can't recover the secret
    // byte-by-byte from response timing. timingSafeEqual requires equal-length
    // buffers, so we precheck the byte length (still safe — leaks only length,
    // which the attacker can already infer from the secret format).
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

    // 2. Process both types of reminders
    const startTime = Date.now();

    const [assessmentResults, workflowResults] = await Promise.all([
      processAssessmentReminders(),
      processWorkflowReminders(),
    ]);

    const duration = Date.now() - startTime;

    // 3. Return combined processing results
    return NextResponse.json({
      success: true,
      assessmentReminders: {
        clientsReminded: assessmentResults.clientsReminded,
      },
      workflowReminders: {
        advisorsNotified: workflowResults.advisorsNotified,
        clientsEscalated: workflowResults.clientsEscalated,
      },
      processingTimeMs: duration,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Error in workflow reminders cron:", error);

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