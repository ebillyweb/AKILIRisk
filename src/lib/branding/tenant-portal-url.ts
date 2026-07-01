export type TenantPortalUrlConfig = {
  productionDomain: string;
  tenantSubdomainSuffix?: string;
  useTenantPathPortals?: boolean;
  /** App origin for `/t/{slug}` portals, e.g. http://localhost:3000 or https://preview.akilirisk.com */
  platformAppOrigin?: string;
  /** @deprecated Prefer platformAppOrigin */
  stagingPlatformHost?: string;
};

function pathPortalOrigin(config: TenantPortalUrlConfig): string {
  if (config.platformAppOrigin?.trim()) {
    return config.platformAppOrigin.trim().replace(/\/$/, "");
  }
  const host =
    config.stagingPlatformHost?.trim() ||
    `preview.${config.productionDomain.trim().toLowerCase()}`;
  return `https://${host}`;
}

/** Display host/path for a tenant portal (no scheme). */
export function buildTenantPortalHost(
  canonicalSlug: string,
  config: TenantPortalUrlConfig,
): string {
  const slug = canonicalSlug.toLowerCase();
  if (config.useTenantPathPortals) {
    const origin = pathPortalOrigin(config);
    try {
      const parsed = new URL(origin);
      return `${parsed.host}/t/${slug}`;
    } catch {
      return `${origin.replace(/^https?:\/\//, "")}/t/${slug}`;
    }
  }

  const suffix = config.tenantSubdomainSuffix ?? "";
  const label = `${slug}${suffix}`;
  return `${label}.${config.productionDomain.trim().toLowerCase()}`;
}

/** Full URL for a tenant's public branded landing page. */
export function buildTenantPortalUrl(
  canonicalSlug: string,
  config: TenantPortalUrlConfig,
): string {
  const slug = canonicalSlug.toLowerCase();
  if (config.useTenantPathPortals) {
    return `${pathPortalOrigin(config)}/t/${slug}`;
  }

  const suffix = config.tenantSubdomainSuffix ?? "";
  return `https://${slug}${suffix}.${config.productionDomain.trim().toLowerCase()}`;
}
