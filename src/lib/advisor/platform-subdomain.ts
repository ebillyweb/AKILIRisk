/**
 * Platform-owned advisor subdomains under PRODUCTION_DOMAIN (e.g. firm.akilirisk.com).
 * Platform hosts (preview, www, app) never enter tenant routing.
 */

/** Labels reserved for infrastructure — not claimable as advisor tenants. */
export const PLATFORM_SUBDOMAIN_LABELS = [
  'www',
  'app',
  'api',
  'admin',
  'preview',
  'staging',
  'dev',
  'test',
  'mail',
  'smtp',
  'cdn',
  'static',
  'assets',
] as const;

export type PlatformSubdomainLabel = (typeof PLATFORM_SUBDOMAIN_LABELS)[number];

export function getProductionDomain(): string | null {
  const domain = process.env.PRODUCTION_DOMAIN?.trim().toLowerCase();
  return domain || null;
}

/**
 * Environment-specific host label suffix before the apex (Preview: `-staging` →
 * `ebilly-staging.akilirisk.com`; Production: `` → `ebilly.akilirisk.com`).
 * Set TENANT_SUBDOMAIN_SUFFIX on Vercel Preview only.
 */
export function getTenantSubdomainSuffix(): string {
  const raw = process.env.TENANT_SUBDOMAIN_SUFFIX?.trim() ?? '';
  if (!raw) return '';
  return raw.startsWith('-') ? raw.toLowerCase() : `-${raw.toLowerCase()}`;
}

/** DNS/host label for a canonical slug stored in AdvisorSubdomain.subdomain. */
export function toTenantHostLabel(canonicalSlug: string): string {
  return `${canonicalSlug.toLowerCase()}${getTenantSubdomainSuffix()}`;
}

/**
 * Map incoming host label to DB slug. When a suffix is configured, only labels
 * ending with that suffix resolve (e.g. preview ignores bare `ebilly.*`).
 */
export function toCanonicalSubdomainSlug(hostLabel: string): string | null {
  const normalized = hostLabel.toLowerCase();
  const suffix = getTenantSubdomainSuffix();

  if (suffix) {
    if (!normalized.endsWith(suffix)) return null;
    const canonical = normalized.slice(0, -suffix.length);
    if (canonical.length < 3 || canonical.length > 20) return null;
    if (isPlatformSubdomainLabel(canonical)) return null;
    return canonical;
  }

  if (isPlatformSubdomainLabel(normalized)) return null;
  return normalized;
}

export function buildAdvisorPortalHostname(canonicalSlug: string): string {
  const domain = getProductionDomain();
  const label = toTenantHostLabel(canonicalSlug);
  if (!domain) {
    return `${label}.example.com`;
  }
  return `${label}.${domain}`;
}

export function buildAdvisorPortalUrl(subdomain: string): string {
  return `https://${buildAdvisorPortalHostname(subdomain)}`;
}

/**
 * When true (default on production/local), claimed subdomains are activated immediately.
 * On Vercel Preview, defaults to false unless SUBDOMAIN_AUTO_ACTIVATE=true (opt-in).
 * Set SUBDOMAIN_AUTO_ACTIVATE=false to restore manual / pending activation.
 */
export function isSubdomainAutoActivateEnabled(): boolean {
  const explicit = process.env.SUBDOMAIN_AUTO_ACTIVATE?.trim().toLowerCase();
  if (explicit === 'false') return false;
  if (explicit === 'true') return true;
  if (process.env.VERCEL_ENV === 'preview') return false;
  return true;
}

export function isPlatformSubdomainLabel(label: string): boolean {
  const normalized = label.toLowerCase();
  if (PLATFORM_SUBDOMAIN_LABELS.includes(normalized as PlatformSubdomainLabel)) {
    return true;
  }
  const extra = process.env.PLATFORM_SUBDOMAIN_LABELS?.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra?.includes(normalized) ?? false;
}

export function normalizeHostname(host: string): string {
  return host.split(':')[0].toLowerCase();
}

/** Full hostnames that always use the main app (not tenant branded routing). */
export function getPlatformHostnames(): ReadonlySet<string> {
  const fromEnv =
    process.env.PLATFORM_HOSTS?.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean) ?? [];

  const domain = getProductionDomain();
  const defaults: string[] = [];
  if (domain) {
    defaults.push(`www.${domain}`, `app.${domain}`, `preview.${domain}`);
  }

  return new Set([...defaults, ...fromEnv]);
}

export function isPlatformHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname);
  return getPlatformHostnames().has(host);
}

/**
 * First label of a multi-part host when it may be an advisor tenant slug.
 * Returns null for apex, localhost without label, and platform labels.
 */
export function extractTenantSubdomainLabel(hostname: string): string | null {
  const host = normalizeHostname(hostname);
  const parts = host.split('.');

  if (host.includes('localhost')) {
    if (parts.length >= 2 && parts[0] !== 'localhost') {
      return toCanonicalSubdomainSlug(parts[0]);
    }
    return null;
  }

  if (parts.length >= 3) {
    return toCanonicalSubdomainSlug(parts[0]);
  }

  return null;
}

export function getSubdomainActivationData(): {
  isActive: boolean;
  dnsVerified: boolean;
  sslProvisioned: boolean;
  verifiedAt: Date | null;
} {
  if (!isSubdomainAutoActivateEnabled()) {
    return {
      isActive: false,
      dnsVerified: false,
      sslProvisioned: false,
      verifiedAt: null,
    };
  }

  const now = new Date();
  return {
    isActive: true,
    dnsVerified: true,
    sslProvisioned: true,
    verifiedAt: now,
  };
}
