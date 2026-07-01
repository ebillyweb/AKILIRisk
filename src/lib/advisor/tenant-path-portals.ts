import {
  getProductionDomain,
  isCanonicalSubdomainSlug,
  normalizeHostname,
} from '@/lib/advisor/platform-subdomain';

/** Path segment for staging tenant portals: preview.akilirisk.com/t/{slug} */
export const STAGING_TENANT_PATH_SEGMENT = 't';

export type StagingTenantPathRoute = {
  slug: string;
  /** App path after the /t/{slug} prefix (e.g. `/`, `/signin`). */
  restPath: string;
};

function sanitizeUrlEnv(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let s = value.trim().replace(/^\uFEFF/, '').replace(/\/$/, '').trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s === '' ? undefined : s;
}

function normalizeOrigin(raw: string | undefined): string | null {
  const s0 = sanitizeUrlEnv(raw);
  if (s0 == null) return null;
  let s = s0.replace(/\/$/, '');
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s.replace(/^\/+/, '')}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;
  } catch {
    return null;
  }
}

/**
 * Platform app origin for path-based tenant portals (`{origin}/t/{slug}`).
 * Uses AUTH_URL / NEXT_PUBLIC_URL, then VERCEL_URL, then localhost.
 */
export function resolvePlatformAppOrigin(): string {
  const fromEnv =
    normalizeOrigin(process.env.AUTH_URL) ??
    normalizeOrigin(process.env.NEXT_PUBLIC_URL) ??
    normalizeOrigin(process.env.NEXTAUTH_URL);

  if (fromEnv) return fromEnv;

  const vercel = sanitizeUrlEnv(process.env.VERCEL_URL);
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, '').split('/')[0]?.trim();
    if (host) {
      const origin = normalizeOrigin(host);
      if (origin) return origin;
    }
  }

  const port = process.env.PORT?.trim() || '3000';
  return `http://localhost:${port}`;
}

/**
 * When true, non-production tenant portals use `{appOrigin}/t/{slug}` instead of
 * `{slug}-staging.{domain}`. Enabled when:
 *   - TENANT_PATH_PORTALS=true, or
 *   - NODE_ENV=development (local dev), or
 *   - VERCEL_ENV=preview, or
 *   - the request host (or AUTH_URL / NEXT_PUBLIC_URL) is `preview.{PRODUCTION_DOMAIN}`
 *
 * Set TENANT_PATH_PORTALS=false to force legacy hostname-suffix staging URLs.
 */
export function usesStagingTenantPathPortals(options?: {
  hostname?: string | null;
}): boolean {
  const explicit = process.env.TENANT_PATH_PORTALS?.trim().toLowerCase();
  if (explicit === 'false') return false;
  if (explicit === 'true') return true;
  if (process.env.NODE_ENV === 'development') return true;
  if (process.env.VERCEL_ENV === 'preview') return true;

  const requestHost = options?.hostname?.trim();
  if (requestHost && isStagingPlatformHostname(requestHost)) return true;

  const appHost = configuredAppHostname();
  if (appHost && isStagingPlatformHostname(appHost)) return true;

  return false;
}

/** True when `hostname` is the staging platform host (`preview.{PRODUCTION_DOMAIN}`). */
export function isStagingPlatformHostname(hostname: string): boolean {
  const stagingHost = getStagingPlatformHostname();
  if (!stagingHost) return false;
  return normalizeHostname(hostname) === stagingHost.toLowerCase();
}

function configuredAppHostname(): string | null {
  for (const key of ['AUTH_URL', 'NEXT_PUBLIC_URL'] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    try {
      return normalizeHostname(new URL(raw).hostname);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Staging platform host (e.g. `preview.akilirisk.com`). Returns null when
 * PRODUCTION_DOMAIN is unset so callers fail loudly instead of emitting links
 * to a bogus placeholder host.
 */
export function getStagingPlatformHostname(): string | null {
  const domain = getProductionDomain();
  if (!domain) return null;
  return `preview.${domain}`;
}

export function isValidTenantPortalSlug(slug: string): boolean {
  return isCanonicalSubdomainSlug(slug);
}

export function buildStagingTenantPathPrefix(slug: string): string {
  return `/${STAGING_TENANT_PATH_SEGMENT}/${slug.toLowerCase()}`;
}

export function buildStagingTenantPortalUrl(slug: string): string {
  return `${resolvePlatformAppOrigin()}${buildStagingTenantPathPrefix(slug)}`;
}

/**
 * Parse `/t/{slug}` and `/t/{slug}/…` paths. Returns null when the path is not a
 * staging tenant route or the slug is invalid.
 */
export function parseStagingTenantPathRoute(pathname: string): StagingTenantPathRoute | null {
  const prefix = `/${STAGING_TENANT_PATH_SEGMENT}/`;
  if (!pathname.startsWith(prefix)) return null;

  const remainder = pathname.slice(prefix.length);
  if (!remainder) return null;

  const slashIndex = remainder.indexOf('/');
  const rawSlug = slashIndex === -1 ? remainder : remainder.slice(0, slashIndex);
  if (!isValidTenantPortalSlug(rawSlug)) return null;

  const restPath =
    slashIndex === -1 ? '/' : remainder.slice(slashIndex) || '/';

  return {
    slug: rawSlug.toLowerCase(),
    restPath: restPath.startsWith('/') ? restPath : `/${restPath}`,
  };
}

/** Prefix an app path with `/t/{slug}` when staging path portals are active. */
export function buildTenantScopedPublicPath(
  appPath: string,
  tenantPathPrefix: string | null | undefined,
): string {
  if (!tenantPathPrefix) {
    return appPath.startsWith('/') ? appPath : `/${appPath}`;
  }

  const base = tenantPathPrefix.replace(/\/$/, '');
  const normalized = appPath.startsWith('/') ? appPath : `/${appPath}`;
  if (normalized === '/') return base;
  return `${base}${normalized}`;
}

/**
 * Extract a tenant slug from a referer, but only when the referer points at the
 * staging platform host. Without the origin check, a forged
 * `Referer: https://evil.example/t/victim` would select another tenant.
 */
export function extractTenantSlugFromReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    const refererHost = url.hostname.toLowerCase();
    const allowedHosts = new Set<string>();
    const platformHost = getStagingPlatformHostname();
    if (platformHost) allowedHosts.add(platformHost.toLowerCase());
    allowedHosts.add(new URL(resolvePlatformAppOrigin()).hostname.toLowerCase());

    if (!allowedHosts.has(refererHost)) return null;
    return parseStagingTenantPathRoute(url.pathname)?.slug ?? null;
  } catch {
    return null;
  }
}
