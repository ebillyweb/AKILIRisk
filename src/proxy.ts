import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAdvisorBySubdomain } from "@/lib/advisor/subdomain";

/**
 * Extract subdomain from hostname
 */
function extractSubdomain(hostname: string): string | null {
  const host = hostname.split(':')[0];
  const parts = host.split('.');

  if (host.includes('localhost')) {
    if (parts.length >= 2 && parts[0] !== 'localhost') {
      return parts[0];
    }
    return null;
  }

  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (!['www', 'app', 'api', 'admin'].includes(subdomain)) {
      return subdomain;
    }
  }

  return null;
}

/** For server layouts (e.g. advisor) that branch on URL without middleware. */
function withAkiliPathname(req: NextRequest): Headers {
  const h = new Headers(req.headers);
  h.set("x-akili-pathname", req.nextUrl.pathname);
  return h;
}

/**
 * Check if path should be handled by subdomain routing
 */
function shouldHandleSubdomain(pathname: string): boolean {
  const skipPaths = ['/api', '/_next', '/favicon.ico', '/robots.txt', '/sitemap.xml', '/.well-known'];
  return !skipPaths.some(path => pathname.startsWith(path));
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

  // Handle subdomain routing first
  if (shouldHandleSubdomain(pathname)) {
    const subdomain = extractSubdomain(hostname);

    if (subdomain) {
      try {
        const advisorSubdomain = await getAdvisorBySubdomain(subdomain);

        if (advisorSubdomain?.isActive && advisorSubdomain?.dnsVerified) {
          // Create headers for advisor context
          const requestHeaders = withAkiliPathname(req);
          requestHeaders.set('x-advisor-id', advisorSubdomain.advisorId);
          requestHeaders.set('x-subdomain', subdomain);
          requestHeaders.set('x-branded-mode', 'true');

          // Rewrite to branded version
          const url = req.nextUrl.clone();
          if (pathname === '/') {
            url.pathname = '/branded/client-portal';
          } else if (pathname.startsWith('/auth')) {
            url.pathname = `/branded${pathname}`;
          } else if (pathname.startsWith('/assessment')) {
            url.pathname = `/branded${pathname}`;
          } else {
            url.pathname = `/branded${pathname}`;
          }

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

  // Continue with existing authentication logic (token from above)
  // `/admin`, `/advisor`, `/intake` are MFA-gated alongside the legacy
  // client surfaces — privileged routes were previously *less* protected
  // than the dashboard, which is the inverse of what we want.
  const protectedRoutes = [
    "/dashboard",
    "/assessment",
    "/settings",
    "/admin",
    "/advisor",
    "/intake",
  ];

  // Segment-aware match: `/admin` matches `/admin` and `/admin/anything`
  // but NOT `/administration`. Plain startsWith would over-match.
  const matchesProtectedPrefix = (route: string): boolean =>
    pathname === route || pathname.startsWith(`${route}/`);
  const isProtectedRoute = protectedRoutes.some(matchesProtectedPrefix);

  const mfaRoutes = ["/mfa/verify", "/mfa/setup"];
  const isMFARoute = mfaRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !isAuthenticated) {
    const signInUrl = new URL("/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAuthenticated && !isMFARoute && isProtectedRoute) {
    const mfaEnabled = Boolean((token as { mfaEnabled?: boolean })?.mfaEnabled);
    const mfaVerified = Boolean(
      (token as { mfaVerified?: boolean })?.mfaVerified
    );
    if (mfaEnabled && !mfaVerified) {
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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
