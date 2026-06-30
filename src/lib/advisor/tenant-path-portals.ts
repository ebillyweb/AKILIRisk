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

/**
 * When true, staging tenant portals use `preview.{domain}/t/{slug}` instead of
 * `{slug}-staging.{domain}`. Enabled when:
 *   - TENANT_PATH_PORTALS=true, or
 *   - VERCEL_ENV=preview, or
 *   - the request host (or AUTH_URL / NEXT_PUBLIC_URL) is `preview.{PRODUCTION_DOMAIN}`
 *
 * Set TENANT_PATH_PORTALS=false to force hostname-suffix staging URLs.
 */
export function usesStagingTenantPathPortals(options?: {
  hostname?: string | null;
}): boolean {
  const explicit = process.env.TENANT_PATH_PORTALS?.trim().toLowerCase();
  if (explicit === 'false') return false;
  if (explicit === 'true') return true;
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
  const host = getStagingPlatformHostname();
  if (!host) {
    throw new Error(
      'Cannot build staging tenant portal URL: PRODUCTION_DOMAIN is not set.'
    );
  }
  return `https://${host}${buildStagingTenantPathPrefix(slug)}`;
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
  const platformHost = getStagingPlatformHostname();
  if (!platformHost) return null;
  try {
    const url = new URL(referer);
    if (url.hostname.toLowerCase() !== platformHost.toLowerCase()) return null;
    return parseStagingTenantPathRoute(url.pathname)?.slug ?? null;
  } catch {
    return null;
  }
}
