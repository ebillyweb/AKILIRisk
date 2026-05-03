import { prisma } from '@/lib/db';

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

/**
 * Clear cache entry after TTL
 */
function setCacheWithTTL(key: string, value: AdvisorSubdomainData | null) {
  subdomainCache.set(key, value);
  setTimeout(() => subdomainCache.delete(key), CACHE_TTL);
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
            userId: true
          }
        }
      }
    });

    // Return the row whenever it exists and the advisor has branding enabled.
    // The caller (proxy.ts) decides whether to rewrite (isActive && dnsVerified)
    // or render the "Subdomain Not Available" page (anything else). Filtering
    // on isActive here would short-circuit the proxy's not-available branch.
    const result = advisorSubdomain && advisorSubdomain.advisor.brandingEnabled
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

    // Cache null result for failed lookups to prevent hammering DB
    setCacheWithTTL(subdomain, null);
    return null;
  }
}

/**
 * Get advisor branding data for subdomain. Only returns branding for
 * subdomains that are both active and DNS-verified - inactive or unverified
 * rows surface as null so callers don't accidentally render a portal for
 * a subdomain that the proxy would otherwise 404.
 */
export async function getAdvisorBrandingBySubdomain(subdomain: string) {
  const advisorData = await getAdvisorBySubdomain(subdomain);

  if (!advisorData) {
    return null;
  }

  if (!advisorData.isActive || !advisorData.dnsVerified) {
    return null;
  }

  try {
    const advisor = await prisma.advisorProfile.findUnique({
      where: { id: advisorData.advisorId },
      select: {
        brandName: true,
        tagline: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        logoUrl: true,
        logoS3Key: true,
        websiteUrl: true,
        emailFooterText: true,
        supportEmail: true,
        supportPhone: true,
        brandingEnabled: true,
        customDomainEnabled: true,
        user: {
          select: {
            subscription: {
              select: {
                tier: true,
                status: true,
              }
            }
          }
        }
      }
    });

    return advisor;
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
  if (subdomain.length < 3 || subdomain.length > 20) {
    return { valid: false, error: 'Subdomain must be 3-20 characters long' };
  }

  // Check format
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
  if (!subdomainRegex.test(subdomain)) {
    return {
      valid: false,
      error: 'Subdomain can only contain lowercase letters, numbers, and hyphens (not at start/end)'
    };
  }

  return { valid: true };
}

/**
 * Check if subdomain is reserved
 */
export async function isSubdomainReserved(subdomain: string): Promise<{ reserved: boolean; reason?: string }> {
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
