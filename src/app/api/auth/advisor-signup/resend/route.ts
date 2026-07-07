import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { resendAdvisorSignupVerificationEmail } from "@/lib/advisor/register-self-serve-advisor";
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
      key: `advisor-signup-resend:${ip}:${rateLimitEmailKey(emailForLimit)}`,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many resend attempts. Please try again later.",
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    const result = await resendAdvisorSignupVerificationEmail(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      email: result.email,
      verificationEmailSent: result.verificationEmailSent,
      verifyUrlForDev: result.verifyUrlForDev,
    });
  } catch (error) {
    console.error("Advisor signup resend error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
