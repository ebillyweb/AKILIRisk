import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpFromRequest } from "@/lib/request-ip";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
});

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP. Token entropy makes brute-forcing the token field
    // infeasible, but a stolen reset link in a 15-minute window is an
    // attacker-known secret; throttling caps how many bcrypt-cost-12
    // attempts an attacker can make against a known-token-but-unknown-
    // password scenario, and dampens generic enumeration on the endpoint.
    const ip = clientIpFromRequest(req) ?? "unknown";
    const rateLimitResult = rateLimit({
      key: `reset-password:${ip}`,
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too many reset attempts. Please try again later.",
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const validation = resetPasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { token: rawToken, email, password } = validation.data;

    // Hash the provided token to match database storage
    const hashedToken = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // Look up token in database
    const verificationToken = await prisma.verificationToken.findUnique({
      where: {
        identifier_token: {
          identifier: email,
          token: hashedToken,
        },
      },
    });

    // Validate token exists and hasn't expired
    if (!verificationToken || verificationToken.expires < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid or expired reset link" },
        { status: 400 }
      );
    }

    // Hash new password with bcrypt (same cost factor as registration)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and delete token in a transaction
    await prisma.$transaction([
      // Update user password
      prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      }),
      // Delete used token
      prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: email,
            token: hashedToken,
          },
        },
      }),
      // Invalidate all existing sessions for security
      prisma.session.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    return NextResponse.json(
      { message: "Password reset successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
