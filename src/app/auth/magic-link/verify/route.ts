import { NextRequest, NextResponse } from "next/server";

import { signIn } from "@/lib/auth";
import { findUserByEmail } from "@/lib/auth/user-email";
import { validateMagicLinkToken } from "@/lib/auth/magic-link";
import { sanitizeMagicLinkRedirectTo } from "@/lib/auth/sign-in-routes";

/**
 * Magic-link click handler (GET /auth/magic-link/verify?token=...).
 *
 * Must be a Route Handler — Next.js App Router forbids setting session
 * cookies from Server Components (signIn writes cookies). The old
 * page.tsx verify flow returned 500 with:
 *   "Cookies can only be modified in a Server Action or Route Handler."
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      failureUrl(req, "not_found")
    );
  }

  const validation = await validateMagicLinkToken(token);
  if (!validation.success) {
    return NextResponse.redirect(
      failureUrl(req, validation.reason)
    );
  }

  // Magic-link sign-in is client-only. Staff accounts must use password
  // sign-in — avoid calling signIn (which would 500 or consume the token).
  const existingUser = await findUserByEmail(validation.email, {
    where: { deletedAt: null },
    select: { role: true },
  });
  if (existingUser && existingUser.role !== "USER") {
    return NextResponse.redirect(failureUrl(req, "staff_use_password"));
  }

  const redirectTo = sanitizeMagicLinkRedirectTo(
    req.nextUrl.searchParams.get("redirectTo"),
    "/dashboard"
  );

  try {
    await signIn("magic-link", {
      token,
      redirectTo,
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    if (isAuthProviderError(error)) {
      const reason =
        (error as { type: string }).type === "CredentialsSignin"
          ? "sign_in_failed"
          : "not_found";
      return NextResponse.redirect(failureUrl(req, reason));
    }
    throw error;
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}

function isAuthProviderError(error: unknown): error is { type: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as { type: unknown }).type === "string"
  );
}

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).includes("NEXT_REDIRECT")
  );
}

function failureUrl(req: NextRequest, reason: string): URL {
  const url = new URL("/auth/magic-link/failed", req.url);
  url.searchParams.set("reason", reason);
  return url;
}
