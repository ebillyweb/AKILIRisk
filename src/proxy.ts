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
  buildTenantScopedPublicPath,
  parseStagingTenantPathRoute,
  usesStagingTenantPathPortals,
} from "@/lib/advisor/tenant-path-portals";
import { isTenantPassThroughPath } from "@/lib/advisor/tenant-pass-through-paths";
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
  h.delete("x-tenant-force-light");
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

/**
 * Result of resolving a tenant host/path:
 *  - `short-circuit`: a finished response (branded `/branded/*` rewrite or the
 *    "Not Available" 404) that must be returned immediately.
 *  - `pass-through`: the tenant is valid but this path stays on the main app
 *    tree. The caller continues into the shared auth/MFA gating (using the
 *    tenant-stripped `effectivePathname`) and emits the final response itself.
 */
type TenantRouteResolution =
  | { type: "short-circuit"; response: NextResponse }
  | { type: "pass-through"; headers: Headers };

async function resolveAdvisorTenantRoute(
  req: NextRequest,
  subdomain: string,
  effectivePathname: string,
  options: TenantBrandingRouteOptions = {},
): Promise<TenantRouteResolution | null> {
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
      // White-label tenant hosts always render light; workspace routes included.
      requestHeaders.set('x-tenant-force-light', 'true');

      if (isTenantPassThroughPath(effectivePathname)) {
        // Hand back the tenant headers and let the main proxy run auth/MFA
        // gating against `effectivePathname`, then rewrite/forward. This is
        // what makes `/t/{slug}/signin`, `/t/{slug}/dashboard`, etc. resolve
        // in path-portal mode (the prefix must be stripped before serving).
        return { type: "pass-through", headers: requestHeaders };
      }

      const url = req.nextUrl.clone();
      url.pathname =
        effectivePathname === '/'
          ? '/branded/client-portal'
          : `/branded${effectivePathname}`;

      return {
        type: "short-circuit",
        response: NextResponse.rewrite(url, {
          request: { headers: requestHeaders },
        }),
      };
    }

    if (advisorSubdomain) {
      return {
        type: "short-circuit",
        response: new NextResponse(
          `<!DOCTYPE html><html><head><title>Subdomain Not Available</title></head><body style="font-family: system-ui; text-align: center; padding: 2rem;"><h1>Subdomain Not Available</h1><p>This subdomain is not currently active.</p></body></html>`,
          { status: 404, headers: { 'Content-Type': 'text/html' } }
        ),
      };
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

  // Normalize the tenant path prefix up front so every downstream guard
  // (deactivation, workspace, MFA, password-change) sees the app-level path.
  // In path-portal mode the raw path is `/t/{slug}/dashboard`; the gating
  // helpers only understand `/dashboard`.
  const pathPortalRoute = usesStagingTenantPathPortals({ hostname })
    ? parseStagingTenantPathRoute(pathname)
    : null;
  const tenantPathPrefix = pathPortalRoute
    ? buildStagingTenantPathPrefix(pathPortalRoute.slug)
    : null;
  const effectivePathname = pathPortalRoute ? pathPortalRoute.restPath : pathname;

  // Tenant-scope a redirect/callback target so the user stays inside the
  // portal during auth flows. No-op (identity) when not in path-portal mode.
  const scopeTarget = (appPath: string): string =>
    buildTenantScopedPublicPath(appPath, tenantPathPrefix);

  // Invitation emails must land on /signup, not /start (self-service code entry).
  if (
    effectivePathname === "/start" &&
    req.nextUrl.searchParams.has("invite")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = scopeTarget("/signup");
    return NextResponse.redirect(url);
  }

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
      effectivePathname.startsWith("/signin") ||
      effectivePathname.startsWith("/api/auth") ||
      effectivePathname.startsWith("/_next");
    if (!allowWhileDeactivated) {
      const signOutUrl = new URL("/api/auth/signout", req.url);
      signOutUrl.searchParams.set("callbackUrl", "/signin?notice=account_deactivated");
      return NextResponse.redirect(signOutUrl);
    }
  }

  let tenantPassThroughHeaders: Headers | null = null;
  if (shouldHandleSubdomain(pathname)) {
    let tenantResolution: TenantRouteResolution | null = null;

    if (pathPortalRoute) {
      tenantResolution = await resolveAdvisorTenantRoute(
        req,
        pathPortalRoute.slug,
        effectivePathname,
        { tenantPathPrefix },
      );
    }

    if (!tenantResolution && !isPlatformHostname(hostname)) {
      const subdomain = extractTenantSubdomainLabel(hostname);
      if (subdomain) {
        tenantResolution = await resolveAdvisorTenantRoute(
          req,
          subdomain,
          pathname,
        );
      }
    }

    if (tenantResolution?.type === "short-circuit") {
      return tenantResolution.response;
    }
    if (tenantResolution?.type === "pass-through") {
      tenantPassThroughHeaders = tenantResolution.headers;
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

  const isWorkspace = isWorkspacePath(effectivePathname);

  if (isWorkspace && !isAuthenticated) {
    // callbackUrl uses the app-level path so `buildSignInHref` infers the
    // correct role tab; the sign-in page itself is tenant-scoped.
    const callbackUrl = `${effectivePathname}${req.nextUrl.search}`;
    const signInHref = buildSignInHref({ callbackUrl });
    return NextResponse.redirect(new URL(scopeTarget(signInHref), req.url));
  }

  if (
    isAuthenticated &&
    !isPagePasswordChangeExempt(effectivePathname) &&
    isWorkspace
  ) {
    if (isPasswordChangePending(mfaClaims)) {
      const changePasswordUrl = new URL(scopeTarget("/change-password"), req.url);
      changePasswordUrl.searchParams.set("callbackUrl", effectivePathname);
      return NextResponse.redirect(changePasswordUrl);
    }
  }

  if (
    isAuthenticated &&
    !isPageMfaExempt(effectivePathname) &&
    isWorkspace
  ) {
    if (isMfaSetupPending(mfaClaims)) {
      const mfaSetupUrl = new URL(scopeTarget("/mfa/setup"), req.url);
      mfaSetupUrl.searchParams.set("callbackUrl", effectivePathname);
      return NextResponse.redirect(mfaSetupUrl);
    }

    if (isMfaChallengePending(mfaClaims)) {
      const mfaVerifyUrl = new URL(scopeTarget("/mfa/verify"), req.url);
      mfaVerifyUrl.searchParams.set("callbackUrl", effectivePathname);
      return NextResponse.redirect(mfaVerifyUrl);
    }
  }

  // Tenant pass-through: forward to the app with tenant headers. In path-portal
  // mode rewrite to the stripped path (`/t/{slug}/dashboard` -> `/dashboard`)
  // so the route resolves; subdomain mode keeps the path in place.
  if (tenantPassThroughHeaders) {
    if (tenantPathPrefix) {
      const url = req.nextUrl.clone();
      url.pathname = effectivePathname;
      return NextResponse.rewrite(url, {
        request: { headers: tenantPassThroughHeaders },
      });
    }
    return NextResponse.next({
      request: { headers: tenantPassThroughHeaders },
    });
  }

  // Path-portal pass-through routes (/signup, /signin, …) must still resolve
  // when the slug is unknown or inactive — otherwise invitation links 404 and
  // clients fall through to /start via the portal nav.
  if (
    pathPortalRoute &&
    isTenantPassThroughPath(effectivePathname)
  ) {
    const url = req.nextUrl.clone();
    url.pathname = effectivePathname;
    const requestHeaders = withAkiliPathname(req);
    requestHeaders.set("x-akili-pathname", effectivePathname);
    if (tenantPathPrefix) {
      requestHeaders.set("x-tenant-path-prefix", tenantPathPrefix);
    }
    return NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
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
