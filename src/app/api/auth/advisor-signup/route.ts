import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";

import { registerSelfServeAdvisor } from "@/lib/advisor/register-self-serve-advisor";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request-ip";

function rateLimitEmailKey(email: string): string {
  return crypto
    .createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const emailForLimit =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "unknown";
    const ip = clientIpFromRequest(req) ?? "unknown";
    const rateLimitResult = rateLimit({
      key: `advisor-signup:${ip}:${rateLimitEmailKey(emailForLimit)}`,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many signup attempts. Please try again later.",
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    const result = await registerSelfServeAdvisor(body);
    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          fieldErrors: result.fieldErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        email: result.email,
        verificationEmailSent: result.verificationEmailSent,
        verifyUrlForDev: result.verifyUrlForDev,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Advisor signup error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
