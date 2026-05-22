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

export function buildAdvisorPortalHostname(subdomain: string): string {
  const domain = getProductionDomain();
  if (!domain) {
    return `${subdomain}.example.com`;
  }
  return `${subdomain}.${domain}`;
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
      const label = parts[0];
      return isPlatformSubdomainLabel(label) ? null : label;
    }
    return null;
  }

  if (parts.length >= 3) {
    const label = parts[0];
    return isPlatformSubdomainLabel(label) ? null : label;
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
