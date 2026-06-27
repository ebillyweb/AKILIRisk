import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createMagicLink } from "@/lib/mobile/magic-link";
import { sendMobileMagicLinkEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function linkBaseUrl(): string {
  return (
    process.env.MOBILE_LINK_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "https://app.akilirisk.com"
  ).replace(/\/$/, "");
}

/**
 * POST /api/auth/magic-link — sends a one-time sign-in link + paste-code.
 * Always returns 200 to avoid leaking which emails have accounts.
 */
export async function POST(request: NextRequest) {
  let email: string;
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    email = parsed.data.email.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Throttle issuance per email and per IP: stops email-bombing a victim and
  // stops an attacker from repeatedly wiping a pending code via re-issue.
  // Returns 200 regardless of which key tripped, to preserve non-enumeration.
  const perEmail = rateLimit({ key: `magic-link:email:${email}`, limit: 3, windowMs: 15 * 60 * 1000 });
  const perIp = rateLimit({ key: `magic-link:ip:${clientIp(request)}`, limit: 10, windowMs: 15 * 60 * 1000 });
  if (!perEmail.success || !perIp.success) {
    return NextResponse.json({ ok: true });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const { linkToken, code } = await createMagicLink(email);
      const url = `${linkBaseUrl()}/auth/verify?token=${encodeURIComponent(linkToken)}`;
      await sendMobileMagicLinkEmail(email, url, code);
    }
  } catch (error) {
    console.error("magic-link error:", error);
    // Fall through to a generic 200 regardless.
  }

  return NextResponse.json({ ok: true });
}
