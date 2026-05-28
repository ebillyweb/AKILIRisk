import { NextRequest, NextResponse } from "next/server";

import { signIn } from "@/lib/auth";
import { validateMagicLinkToken } from "@/lib/auth/magic-link";

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

  await signIn("magic-link", {
    token,
    redirectTo: "/dashboard",
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}

function failureUrl(req: NextRequest, reason: string): URL {
  const url = new URL("/auth/magic-link/failed", req.url);
  url.searchParams.set("reason", reason);
  return url;
}
