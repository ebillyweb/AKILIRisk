import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAdvisorBySubdomain } from "@/lib/advisor/subdomain";
import {
  extractTenantSubdomainLabel,
  isPlatformHostname,
} from "@/lib/advisor/platform-subdomain";
import {
  buildStagingTenantPathPrefix,
  parseStagingTenantPathRoute,
  usesStagingTenantPathPortals,
} from "@/lib/advisor/tenant-path-portals";
import { isTenantPassThroughPath } from "@/lib/advisor/tenant-pass-through-paths";
import { isTenantPublicSurfacePath } from "@/lib/advisor/tenant-public-surface";
import {
  isMfaChallengePending,
  isPageMfaExempt,
  isWorkspacePath,
  isMfaSetupPending,
  shouldBlockApiForMfaPending,
  shouldBlockApiForMfaSetupPending,
} from "@/lib/auth/mfa-gate";
import {
  isPasswordChangePending,
  isPagePasswordChangeExempt,
  shouldBlockApiForPasswordChangePending,
} from "@/lib/auth/password-change-gate";
import { buildSignInHref } from "@/lib/auth/sign-in-routes";

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
  h.delete("x-tenant-path-prefix");
  return h;
}

/**
 * Check if path should be handled by subdomain routing
 */
function shouldHandleSubdomain(pathname: string): boolean {
  const skipPaths = [
    '/api',
    '/_next',
    '/favicon.ico',
    '/site.webmanifest',
    '/robots.txt',
    '/sitemap.xml',
    '/.well-known',
  ];
  return !skipPaths.some(path => pathname.startsWith(path));
}

type TenantBrandingRouteOptions = {
  tenantPathPrefix?: string | null;
};

async function handleAdvisorTenantBrandingRoute(
  req: NextRequest,
  subdomain: string,
  effectivePathname: string,
  options: TenantBrandingRouteOptions = {},
): Promise<NextResponse | null> {
  try {
    const advisorSubdomain = await getAdvisorBySubdomain(subdomain);

    if (advisorSubdomain?.isActive && advisorSubdomain?.dnsVerified) {
      const requestHeaders = withAkiliPathname(req);
      requestHeaders.set('x-advisor-id', advisorSubdomain.advisorId);
      requestHeaders.set('x-subdomain', subdomain);
      requestHeaders.set('x-branded-mode', 'true');
      requestHeaders.set('x-akili-pathname', effectivePathname);
      if (options.tenantPathPrefix) {
        requestHeaders.set('x-tenant-path-prefix', options.tenantPathPrefix);
      }
      if (isTenantPublicSurfacePath(effectivePathname)) {
        requestHeaders.set('x-tenant-force-light', 'true');
      }

      if (isTenantPassThroughPath(effectivePathname)) {
        return NextResponse.next({
          request: { headers: requestHeaders },
        });
      }

      const url = req.nextUrl.clone();
      url.pathname =
        effectivePathname === '/'
          ? '/branded/client-portal'
          : `/branded${effectivePathname}`;

      return NextResponse.rewrite(url, {
        request: { headers: requestHeaders },
      });
    }

    if (advisorSubdomain) {
      return new NextResponse(
        `<!DOCTYPE html><html><head><title>Subdomain Not Available</title></head><body style="font-family: system-ui; text-align: center; padding: 2rem;"><h1>Subdomain Not Available</h1><p>This subdomain is not currently active.</p></body></html>`,
        { status: 404, headers: { 'Content-Type': 'text/html' } }
      );
    }
  } catch (error) {
    console.error('Subdomain resolution error:', error);
  }

  return null;
}

/**
 * Routes served on the main app tree with tenant headers (not /branded rewrites).
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

  if (shouldHandleSubdomain(pathname)) {
    if (usesStagingTenantPathPortals()) {
      const pathRoute = parseStagingTenantPathRoute(pathname);
      if (pathRoute) {
        const tenantResponse = await handleAdvisorTenantBrandingRoute(
          req,
          pathRoute.slug,
          pathRoute.restPath,
          { tenantPathPrefix: buildStagingTenantPathPrefix(pathRoute.slug) },
        );
        if (tenantResponse) return tenantResponse;
      }
    }

    if (!isPlatformHostname(hostname)) {
      const subdomain = extractTenantSubdomainLabel(hostname);

      if (subdomain) {
        const tenantResponse = await handleAdvisorTenantBrandingRoute(
          req,
          subdomain,
          pathname,
        );
        if (tenantResponse) return tenantResponse;
      }
    }
  }

  // US-48: block workspace API calls until MFA challenge completes. Auth
  // routes (/api/auth/* including mfa/verify) stay reachable so the user
  // can finish the challenge; cron/webhooks use their own secrets.
  type JwtClaims = {
    id?: string;
    sub?: string;
    mfaEnabled?: boolean;
    mfaVerified?: boolean;
    mfaEnrollmentRequired?: boolean;
    passwordChangeRequired?: boolean;
  };
  const jwt = token as JwtClaims | null;
  const mfaClaims = {
    id: jwt?.id ?? jwt?.sub,
    mfaEnabled: jwt?.mfaEnabled,
    mfaVerified: jwt?.mfaVerified,
    mfaEnrollmentRequired: jwt?.mfaEnrollmentRequired,
    passwordChangeRequired: jwt?.passwordChangeRequired,
  };

  if (
    isAuthenticated &&
    isPasswordChangePending(mfaClaims) &&
    shouldBlockApiForPasswordChangePending(pathname)
  ) {
    return NextResponse.json(
      { error: "Password update required" },
      { status: 403 }
    );
  }

  if (
    isAuthenticated &&
    isMfaSetupPending(mfaClaims) &&
    shouldBlockApiForMfaSetupPending(pathname)
  ) {
    return NextResponse.json(
      { error: "MFA enrollment required" },
      { status: 403 }
    );
  }

  if (
    isAuthenticated &&
    isMfaChallengePending(mfaClaims) &&
    shouldBlockApiForMfaPending(pathname)
  ) {
    return NextResponse.json(
      { error: "MFA verification required" },
      { status: 403 }
    );
  }

  const isWorkspace = isWorkspacePath(pathname);

  if (isWorkspace && !isAuthenticated) {
    const callbackUrl = `${pathname}${req.nextUrl.search}`;
    const signInHref = buildSignInHref({ callbackUrl });
    return NextResponse.redirect(new URL(signInHref, req.url));
  }

  if (
    isAuthenticated &&
    !isPagePasswordChangeExempt(pathname) &&
    isWorkspace
  ) {
    if (isPasswordChangePending(mfaClaims)) {
      const changePasswordUrl = new URL("/change-password", req.url);
      changePasswordUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(changePasswordUrl);
    }
  }

  if (
    isAuthenticated &&
    !isPageMfaExempt(pathname) &&
    isWorkspace
  ) {
    if (isMfaSetupPending(mfaClaims)) {
      const mfaSetupUrl = new URL("/mfa/setup", req.url);
      mfaSetupUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(mfaSetupUrl);
    }

    if (isMfaChallengePending(mfaClaims)) {
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
    "/((?!_next/static|_next/image|favicon.ico|site.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
