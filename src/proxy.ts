import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAdvisorBySubdomain } from "@/lib/advisor/subdomain";
import {
  extractTenantSubdomainLabel,
  isPlatformHostname,
} from "@/lib/advisor/platform-subdomain";
import {
  isPageMfaExempt,
  isWorkspacePath,
  shouldBlockApiForMfaPending,
} from "@/lib/auth/mfa-gate";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";
import { isMfaChallengePendingForUser } from "@/lib/auth/mfa-session-status";

/** For server layouts (e.g. advisor) that branch on URL without middleware.
 *
 *  Also scrubs the `x-advisor-id` / `x-subdomain` / `x-branded-mode` headers
 *  on the non-subdomain forwarding path. Those headers are written ONLY by
 *  the subdomain-rewrite branch below (after a successful AdvisorSubdomain
 *  lookup). If a client sends them directly to a regular URL, the branded
 *  layout would otherwise read them as if the proxy had asserted them —
 *  letting any caller render `/branded/...` for any tenant they name.
 *  Stripping here closes that injection vector. */
function withAkiliPathname(req: NextRequest): Headers {
  const h = new Headers(req.headers);
  h.set("x-akili-pathname", req.nextUrl.pathname);
  h.delete("x-advisor-id");
  h.delete("x-subdomain");
  h.delete("x-branded-mode");
  return h;
}

/**
 * Check if path should be handled by subdomain routing
 */
function shouldHandleSubdomain(pathname: string): boolean {
  const skipPaths = ['/api', '/_next', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/.well-known'];
  return !skipPaths.some(path => pathname.startsWith(path));
}

/** Routes served on the main app tree with tenant headers (not /branded rewrites). */
const TENANT_PASS_THROUGH_PREFIXES = [
  "/signup",
  "/signin",
  "/advisor",
  "/intake",
  "/assessment",
  "/dashboard",
  "/settings",
  "/mfa",
  "/forgot-password",
  "/reset-password",
  "/request-review",
  "/start",
  "/terms",
  "/privacy",
  "/about",
  "/contact",
] as const;

function isTenantPassThroughPath(pathname: string): boolean {
  return TENANT_PASS_THROUGH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Edge-compatible proxy using getToken (no NextAuth config in Edge).
 * Protects routes and enforces MFA redirect using JWT claims only.
 * Also handles subdomain routing for advisor branding.
 */
export default async function proxy(req: NextRequest) {
  const hostname = req.headers.get('host') || '';
  const pathname = req.nextUrl.pathname;

  const proto = req.headers.get("x-forwarded-proto");
  const secureCookie = proto === "https" || req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  const isAuthenticated = !!token;

  const accountDeactivated = Boolean(
    (token as { accountDeactivated?: boolean })?.accountDeactivated
  );
  if (isAuthenticated && accountDeactivated) {
    const allowWhileDeactivated =
      pathname.startsWith("/signin") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/_next");
    if (!allowWhileDeactivated) {
      const signOutUrl = new URL("/api/auth/signout", req.url);
      signOutUrl.searchParams.set("callbackUrl", "/signin?notice=account_deactivated");
      return NextResponse.redirect(signOutUrl);
    }
  }

  // Handle advisor tenant subdomain routing (skip platform hosts like preview.*)
  if (shouldHandleSubdomain(pathname) && !isPlatformHostname(hostname)) {
    const subdomain = extractTenantSubdomainLabel(hostname);

    if (subdomain) {
      try {
        const advisorSubdomain = await getAdvisorBySubdomain(subdomain);

        if (advisorSubdomain?.isActive && advisorSubdomain?.dnsVerified) {
          const requestHeaders = withAkiliPathname(req);
          requestHeaders.set('x-advisor-id', advisorSubdomain.advisorId);
          requestHeaders.set('x-subdomain', subdomain);
          requestHeaders.set('x-branded-mode', 'true');

          if (isTenantPassThroughPath(pathname)) {
            return NextResponse.next({
              request: { headers: requestHeaders },
            });
          }

          const url = req.nextUrl.clone();
          url.pathname =
            pathname === '/' ? '/branded/client-portal' : `/branded${pathname}`;

          return NextResponse.rewrite(url, {
            request: { headers: requestHeaders },
          });
        } else if (advisorSubdomain) {
          // Subdomain exists but not active/verified
          return new NextResponse(
            `<!DOCTYPE html><html><head><title>Subdomain Not Available</title></head><body style="font-family: system-ui; text-align: center; padding: 2rem;"><h1>Subdomain Not Available</h1><p>This subdomain is not currently active.</p></body></html>`,
            { status: 404, headers: { 'Content-Type': 'text/html' } }
          );
        }
      } catch (error) {
        console.error('Subdomain resolution error:', error);
        // Continue with normal processing on error
      }
    }
  }

  // US-48: block workspace API calls until MFA challenge completes. Auth
  // routes (/api/auth/* including mfa/verify) stay reachable so the user
  // can finish the challenge; cron/webhooks use their own secrets.
  const mfaClaims = token as {
    id?: string;
    mfaEnabled?: boolean;
    mfaVerified?: boolean;
  };
  if (
    isAuthenticated &&
    (await isMfaChallengePendingForUser(mfaClaims)) &&
    shouldBlockApiForMfaPending(pathname)
  ) {
    return NextResponse.json(
      { error: "MFA verification required" },
      { status: 403 }
    );
  }

  const isWorkspace = isWorkspacePath(pathname);

  if (isWorkspace && !isAuthenticated) {
    const signInHref = buildSignInHref({ callbackUrl: pathname });
    return NextResponse.redirect(new URL(signInHref, req.url));
  }

  if (
    isAuthenticated &&
    !isPageMfaExempt(pathname) &&
    isWorkspace
  ) {
    if (await isMfaChallengePendingForUser(mfaClaims)) {
      const mfaVerifyUrl = new URL("/mfa/verify", req.url);
      mfaVerifyUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(mfaVerifyUrl);
    }
  }

  return NextResponse.next({
    request: { headers: withAkiliPathname(req) },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
