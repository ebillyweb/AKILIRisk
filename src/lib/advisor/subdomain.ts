import { prisma } from '@/lib/db';
import { resolveAdvisorBrandingForProfile } from '@/lib/enterprise/branding';
import type { AdvisorBrandingData } from '@/lib/validation/branding';
import {
  getTenantSubdomainSuffix,
  isPlatformSubdomainLabel,
  isSubdomainAutoActivateEnabled,
  toTenantHostLabel,
} from '@/lib/advisor/platform-subdomain';
import {
  SUBDOMAIN_SLUG_MAX_LENGTH,
  SUBDOMAIN_SLUG_MIN_LENGTH,
  SUBDOMAIN_SLUG_REGEX,
  SUBDOMAIN_SLUG_VALIDATION_MESSAGE,
} from '@/lib/advisor/subdomain-slug-input';

/** Shape passed from the server into SubdomainManager after a claim. */
export interface AdvisorSubdomainSettings {
  subdomain: string;
  status: 'active' | 'pending_verification' | 'inactive';
  dnsVerified: boolean;
  sslProvisioned: boolean;
  verificationInstructions?: {
    type: string;
    record: string;
    value: string;
    instructions: string;
  };
}

/**
 * Advisor subdomain data structure
 */
export interface AdvisorSubdomainData {
  advisorId: string;
  subdomain: string;
  isActive: boolean;
  dnsVerified: boolean;
  sslProvisioned: boolean;
}

/**
 * In-memory cache for subdomain resolution
 * In production, use Redis or similar
 */
const subdomainCache = new Map<string, AdvisorSubdomainData | null>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
// Errors are cached only briefly: a transient DB blip should not make an active
// tenant 404 for the full TTL after the DB recovers. Short enough to recover
// fast, long enough to dampen hammering during an outage.
const CACHE_ERROR_TTL = 5 * 1000; // 5 seconds

/**
 * Clear cache entry after TTL
 */
function setCacheWithTTL(
  key: string,
  value: AdvisorSubdomainData | null,
  ttl: number = CACHE_TTL
) {
  subdomainCache.set(key, value);
  setTimeout(() => subdomainCache.delete(key), ttl);
}

/**
 * Get advisor by subdomain with caching
 */
export async function getAdvisorBySubdomain(subdomain: string): Promise<AdvisorSubdomainData | null> {
  // Check cache first
  const cached = subdomainCache.get(subdomain);
  if (cached !== undefined) {
    return cached;
  }

  try {
    // Query database for subdomain
    const advisorSubdomain = await prisma.advisorSubdomain.findUnique({
      where: { subdomain },
      include: {
        advisor: {
          select: {
            id: true,
            brandingEnabled: true,
            userId: true,
            enterpriseId: true,
          }
        },
        enterprise: {
          select: {
            id: true,
            slug: true,
            brandingEnabled: true,
          },
        },
      }
    });

    const brandingEnabled =
      advisorSubdomain?.enterprise?.brandingEnabled ??
      advisorSubdomain?.advisor?.brandingEnabled ??
      false;

    const result = advisorSubdomain && brandingEnabled
      ? {
          advisorId: advisorSubdomain.advisorId,
          subdomain: advisorSubdomain.subdomain,
          isActive: advisorSubdomain.isActive,
          dnsVerified: advisorSubdomain.dnsVerified,
          sslProvisioned: advisorSubdomain.sslProvisioned,
        }
      : null;

    // Cache result
    setCacheWithTTL(subdomain, result);

    return result;
  } catch (error) {
    console.error('Error resolving subdomain:', error);

    // Cache the failure only briefly (not the full TTL) so a recovered DB
    // resolves the tenant again right away instead of serving a stale 404.
    setCacheWithTTL(subdomain, null, CACHE_ERROR_TTL);
    return null;
  }
}

/**
 * Get advisor branding data for subdomain. Only returns branding for
 * subdomains that are both active and DNS-verified - inactive or unverified
 * rows surface as null so callers don't accidentally render a portal for
 * a subdomain that the proxy would otherwise 404.
 */
export async function getAdvisorBrandingBySubdomain(
  subdomain: string
): Promise<AdvisorBrandingData | null> {
  const advisorData = await getAdvisorBySubdomain(subdomain);

  if (!advisorData) {
    return null;
  }

  if (!advisorData.isActive || !advisorData.dnsVerified) {
    return null;
  }

  try {
    const subdomainRow = await prisma.advisorSubdomain.findUnique({
      where: { subdomain },
      select: { enterpriseId: true },
    });
    const scope = subdomainRow?.enterpriseId ? "firm" : "client";
    return await resolveAdvisorBrandingForProfile(advisorData.advisorId, { scope });
  } catch (error) {
    console.error('Error fetching advisor branding:', error);
    return null;
  }
}

/**
 * Clear subdomain cache (for admin operations)
 */
export function clearSubdomainCache(subdomain?: string) {
  if (subdomain) {
    subdomainCache.delete(subdomain);
  } else {
    subdomainCache.clear();
  }
}

/**
 * Get cache stats (for monitoring)
 */
export function getSubdomainCacheStats() {
  return {
    size: subdomainCache.size,
    entries: Array.from(subdomainCache.keys())
  };
}

/**
 * Validate subdomain format
 */
export function validateSubdomainFormat(subdomain: string): { valid: boolean; error?: string } {
  // Check length
  if (subdomain.length < SUBDOMAIN_SLUG_MIN_LENGTH || subdomain.length > SUBDOMAIN_SLUG_MAX_LENGTH) {
    return { valid: false, error: SUBDOMAIN_SLUG_VALIDATION_MESSAGE };
  }

  if (!SUBDOMAIN_SLUG_REGEX.test(subdomain)) {
    return {
      valid: false,
      error: SUBDOMAIN_SLUG_VALIDATION_MESSAGE,
    };
  }

  const envSuffix = getTenantSubdomainSuffix();
  if (envSuffix && subdomain.endsWith(envSuffix)) {
    return {
      valid: false,
      error: `Do not include "${envSuffix}" in your subdomain — it is added automatically in this environment`,
    };
  }

  const hostLabel = toTenantHostLabel(subdomain);
  if (hostLabel.length > 63) {
    return {
      valid: false,
      error: 'Subdomain is too long for this environment',
    };
  }

  return { valid: true };
}

/**
 * Check if subdomain is reserved
 */
export async function isSubdomainReserved(subdomain: string): Promise<{ reserved: boolean; reason?: string }> {
  if (isPlatformSubdomainLabel(subdomain)) {
    return {
      reserved: true,
      reason: 'Reserved for platform infrastructure',
    };
  }

  try {
    const reserved = await prisma.reservedSubdomains.findUnique({
      where: { subdomain }
    });

    if (reserved) {
      return { reserved: true, reason: reserved.reason };
    }

    return { reserved: false };
  } catch (error) {
    console.error('Error checking reserved subdomain:', error);
    return { reserved: true, reason: 'Database error' };
  }
}

/**
 * Generate subdomain suggestions
 */
export function generateSubdomainSuggestions(baseSubdomain: string): string[] {
  const suggestions: string[] = [];
  const suffixes = ['hq', 'group', 'capital', 'advisors', 'pro', 'wealth'];
  const prefixes = ['my', 'the', 'team'];

  // Add number suffixes
  for (let i = 1; i <= 5; i++) {
    const suggestion = `${baseSubdomain}${i}`;
    if (suggestion.length <= 20) {
      suggestions.push(suggestion);
    }
  }

  // Add word suffixes
  suffixes.forEach(suffix => {
    const suggestion = `${baseSubdomain}${suffix}`;
    if (suggestion.length <= 20) {
      suggestions.push(suggestion);
    }
  });

  // Add word prefixes
  prefixes.forEach(prefix => {
    const suggestion = `${prefix}${baseSubdomain}`;
    if (suggestion.length <= 20) {
      suggestions.push(suggestion);
    }
  });

  return suggestions.slice(0, 8); // Return top 8 suggestions
}

/**
 * DNS setup instructions for a claimed subdomain.
 * Requires PRODUCTION_DOMAIN — callers must handle a missing env gracefully.
 */
export function generateDNSInstructions(subdomain: string): {
  type: string;
  record: string;
  value: string;
  instructions: string;
} {
  const productionDomain = process.env.PRODUCTION_DOMAIN?.trim();
  if (!productionDomain) {
    throw new Error('PRODUCTION_DOMAIN is not configured');
  }

  const hostLabel = toTenantHostLabel(subdomain);
  return {
    type: 'CNAME',
    record: `${hostLabel}.${productionDomain}`,
    value: `app.${productionDomain}`,
    instructions: `Create a CNAME record pointing ${hostLabel}.${productionDomain} to app.${productionDomain}, or ask your platform administrator to activate the subdomain.`,
  };
}

function subdomainSettingsStatus(row: {
  isActive: boolean;
  dnsVerified: boolean;
  sslProvisioned: boolean;
}): AdvisorSubdomainSettings['status'] {
  if (row.isActive && row.dnsVerified && row.sslProvisioned) {
    return 'active';
  }
  if (!row.dnsVerified) {
    return 'pending_verification';
  }
  return 'inactive';
}

/**
 * Load the advisor's claimed subdomain for settings UI.
 */
export async function getAdvisorSubdomainSettings(
  advisorId: string
): Promise<AdvisorSubdomainSettings | null> {
  const row = await prisma.advisorSubdomain.findUnique({
    where: { advisorId },
  });

  if (!row) {
    return null;
  }

  let verificationInstructions: AdvisorSubdomainSettings['verificationInstructions'];
  if (!row.dnsVerified && !isSubdomainAutoActivateEnabled()) {
    try {
      verificationInstructions = generateDNSInstructions(row.subdomain);
    } catch {
      verificationInstructions = undefined;
    }
  }

  return {
    subdomain: row.subdomain,
    status: subdomainSettingsStatus(row),
    dnsVerified: row.dnsVerified,
    sslProvisioned: row.sslProvisioned,
    verificationInstructions,
  };
}
