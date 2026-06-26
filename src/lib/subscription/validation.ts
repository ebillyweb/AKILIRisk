import { prisma } from '@/lib/db';
import { resolveBillingContext } from '@/lib/enterprise/billing-context';
import { LOGO_MAX_BYTES, SubscriptionFeatures } from '@/lib/validation/branding';

/**
 * Feature mapping by subscription tier.
 * Essentials: logo and basic identity. Professional+: full branding surface.
 */
const TIER_FEATURES = {
  ESSENTIALS: {
    basicBrandingEnabled: true,
    advancedBrandingEnabled: false,
    customSubdomainEnabled: false,
    whiteLabel: false,
  },
  PROFESSIONAL: {
    basicBrandingEnabled: true,
    advancedBrandingEnabled: true,
    customSubdomainEnabled: true,
    whiteLabel: true,
  },
  BUSINESS: {
    basicBrandingEnabled: true,
    advancedBrandingEnabled: true,
    customSubdomainEnabled: true,
    whiteLabel: true,
  },
  PLATINUM: {
    basicBrandingEnabled: true,
    advancedBrandingEnabled: true,
    customSubdomainEnabled: true,
    whiteLabel: true,
  },
  ENTERPRISE: {
    basicBrandingEnabled: true,
    advancedBrandingEnabled: true,
    customSubdomainEnabled: true,
    whiteLabel: true,
  },
} as const;

/** Used when no billing row exists yet (e.g. local dev) so advisor branding UI still loads.
 *  Do NOT use directly as a fallback in production code paths — see
 *  `missingSubscriptionFallback` below, which fails closed in production. */
export const ESSENTIALS_SUBSCRIPTION_FEATURES: SubscriptionFeatures = {
  tier: 'ESSENTIALS',
  ...TIER_FEATURES.ESSENTIALS,
};

/** Fail-closed entitlement set: every paid feature off. Returned in production
 *  when no Subscription row is found (or `getSubscriptionFeatures` errored).
 *  `tier: 'ESSENTIALS'` is just a label so the type checks; every feature is false. */
export const NO_SUBSCRIPTION_FEATURES: SubscriptionFeatures = {
  tier: 'ESSENTIALS',
  basicBrandingEnabled: false,
  advancedBrandingEnabled: false,
  customSubdomainEnabled: false,
  whiteLabel: false,
};

/** Resolve the fallback to use when `getSubscriptionFeatures` returns null.
 *  Production: fail closed (NO_SUBSCRIPTION_FEATURES).
 *  Non-production: keep the dev-friendly STARTER fallback so local UIs still load
 *  without a seeded Subscription row. */
function missingSubscriptionFallback(): SubscriptionFeatures {
  return process.env.NODE_ENV === 'production'
    ? NO_SUBSCRIPTION_FEATURES
    : ESSENTIALS_SUBSCRIPTION_FEATURES;
}

type SubscriptionRow = {
  tier: keyof typeof TIER_FEATURES;
};

/**
 * Maps a Subscription row to UI/API feature flags by tier (not per-row booleans),
 * so branding stays consistent even if legacy DB columns are out of date.
 *
 * Branding is keyed off tier only — billing status does not strip basic branding
 * (advisors can still manage identity/logo/colors; enforce payment elsewhere if needed).
 */
export function subscriptionFeaturesFromRow(
  subscription: SubscriptionRow
): SubscriptionFeatures {
  const caps = TIER_FEATURES[subscription.tier] ?? TIER_FEATURES.ESSENTIALS;
  return {
    tier: subscription.tier,
    ...caps,
  };
}

/**
 * Get subscription features for a user
 */
export async function getSubscriptionFeatures(userId: string): Promise<SubscriptionFeatures | null> {
  try {
    const billingCtx = await resolveBillingContext(userId);
    const subscription = billingCtx?.subscription;

    if (!subscription) {
      return null;
    }

    return subscriptionFeaturesFromRow(subscription);
  } catch (error) {
    console.error('Error fetching subscription features:', error);
    return null;
  }
}

/**
 * Validate if a user has access to a specific feature
 */
export async function validateSubscriptionFeature(
  userId: string,
  feature: keyof Omit<SubscriptionFeatures, 'tier'>
): Promise<boolean> {
  const features =
    (await getSubscriptionFeatures(userId)) ?? missingSubscriptionFallback();

  return features[feature];
}

/**
 * Require specific subscription feature access
 * Throws error if user doesn't have access
 */
export async function requireSubscriptionFeature(
  userId: string,
  feature: keyof Omit<SubscriptionFeatures, 'tier'>,
  customErrorMessage?: string
): Promise<SubscriptionFeatures> {
  const features =
    (await getSubscriptionFeatures(userId)) ?? missingSubscriptionFallback();

  if (!features[feature]) {
    const featureNames = {
      basicBrandingEnabled: 'basic branding features',
      advancedBrandingEnabled: 'advanced branding features',
      customSubdomainEnabled: 'custom subdomain',
      whiteLabel: 'white-label features',
    };

    const defaultMessage = `Your current plan (${features.tier}) does not include ${featureNames[feature]}. Please upgrade your subscription.`;

    throw new Error(customErrorMessage || defaultMessage);
  }

  return features;
}

/**
 * Check if advisor has access to branding management
 */
export async function requireAdvisorBrandingAccess(
  userId: string,
  operation: 'read' | 'write' | 'delete' = 'read'
): Promise<{ advisorId: string; features: SubscriptionFeatures }> {
  // Get advisor profile
  const advisor = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { id: true, brandingEnabled: true },
  });

  if (!advisor) {
    throw new Error('Advisor profile not found');
  }

  if (!advisor.brandingEnabled) {
    throw new Error('Branding features are disabled for this advisor');
  }

  // Check subscription access based on operation
  let requiredFeature: keyof Omit<SubscriptionFeatures, 'tier'>;

  switch (operation) {
    case 'read':
      requiredFeature = 'basicBrandingEnabled';
      break;
    case 'write':
    case 'delete':
      requiredFeature = 'basicBrandingEnabled';
      break;
  }

  const features = await requireSubscriptionFeature(userId, requiredFeature);

  return {
    advisorId: advisor.id,
    features,
  };
}

/**
 * Check if advisor has access to subdomain features
 */
export async function requireSubdomainAccess(userId: string): Promise<{
  advisorId: string;
  features: SubscriptionFeatures;
}> {
  const advisor = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!advisor) {
    throw new Error('Advisor profile not found');
  }

  const features = await requireSubscriptionFeature(
    userId,
    'customSubdomainEnabled',
    'Custom subdomain feature is not available on your current plan'
  );

  return {
    advisorId: advisor.id,
    features,
  };
}

/**
 * Get feature limits based on subscription tier
 */
export function getFeatureLimits(tier: 'ESSENTIALS' | 'PROFESSIONAL' | 'BUSINESS') {
  const professional = {
    logoMaxSize: LOGO_MAX_BYTES,
    customColors: 3,
    subdomainChangesPerDay: 3,
    brandingFields: [
      'logoUrl',
      'brandName',
      'tagline',
      'primaryColor',
      'secondaryColor',
      'accentColor',
      'websiteUrl',
      'emailFooterText',
      'supportEmail',
      'supportPhone',
    ],
  } as const;

  const limits = {
    ESSENTIALS: professional,
    PROFESSIONAL: professional,
    BUSINESS: professional,
  };

  return limits[tier];
}

/**
 * Check rate limits for specific operations
 */
export async function checkRateLimit(
  advisorId: string,
  operation: 'subdomain_change' | 'logo_upload',
  windowHours: number = 24
): Promise<{ allowed: boolean; remaining: number; resetTime: Date }> {
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - windowHours);

  let actionType: string;
  let tierLimits: Record<string, number>;

  switch (operation) {
    case 'subdomain_change':
      actionType = 'CLAIM_SUBDOMAIN';
      tierLimits = { ESSENTIALS: 3, PROFESSIONAL: 3, BUSINESS: 3 };
      break;
    case 'logo_upload':
      actionType = 'UPLOAD_LOGO';
      tierLimits = { ESSENTIALS: 20, PROFESSIONAL: 20, BUSINESS: 20 };
      break;
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }

  // Get advisor's subscription tier
  const advisor = await prisma.advisorProfile.findUnique({
    where: { id: advisorId },
    include: {
      user: {
        include: {
          subscription: {
            select: { tier: true }
          }
        }
      }
    }
  });

  if (!advisor) {
    return { allowed: false, remaining: 0, resetTime: new Date() };
  }

  const tier = advisor.user.subscription?.tier ?? 'ESSENTIALS';
  const limit = tierLimits[tier];

  // Count recent actions
  const recentActions = await prisma.advisorBrandingAuditLog.count({
    where: {
      advisorId,
      action: actionType,
      timestamp: {
        gte: windowStart,
      },
    },
  });

  const resetTime = new Date();
  resetTime.setHours(resetTime.getHours() + windowHours);

  return {
    allowed: recentActions < limit,
    remaining: Math.max(0, limit - recentActions),
    resetTime,
  };
}

/**
 * Upgrade path suggestions
 */
export function getUpgradeRecommendations(
  currentTier: 'ESSENTIALS' | 'PROFESSIONAL' | 'BUSINESS',
  requestedFeature: string
): {
  suggestedTier: 'PROFESSIONAL' | 'BUSINESS' | null;
  features: string[];
  message: string;
} | null {
  const upgradePaths = {
    ESSENTIALS: {
      PROFESSIONAL: {
        features: [
          'Custom brand colors',
          'Custom subdomain',
          'Extended branding fields',
          'Priority support'
        ],
        message: 'Upgrade to Growth to unlock advanced branding features and custom subdomain.'
      },
      BUSINESS: {
        features: [
          'All Growth features',
          'White-label experience',
          'Accent color customization',
          'Dedicated support',
          'Advanced analytics'
        ],
        message: 'Upgrade to Professional for complete white-label branding control.'
      }
    },
    PROFESSIONAL: {
      BUSINESS: {
        features: [
          'White-label experience',
          'Accent color customization',
          'Advanced rate limits',
          'Dedicated support',
          'Advanced analytics'
        ],
        message: 'Upgrade to Professional for complete white-label experience.'
      }
    }
  };

  const featureRequirements = {
    'advancedBrandingEnabled': 'PROFESSIONAL',
    'customSubdomainEnabled': 'PROFESSIONAL',
    'whiteLabel': 'BUSINESS',
  };

  const requiredTier = featureRequirements[requestedFeature as keyof typeof featureRequirements];
  if (!requiredTier) return null;

  if (currentTier === 'ESSENTIALS' && requiredTier === 'PROFESSIONAL') {
    return {
      suggestedTier: 'PROFESSIONAL',
      ...upgradePaths.ESSENTIALS.PROFESSIONAL
    };
  }

  if (currentTier === 'ESSENTIALS' && requiredTier === 'BUSINESS') {
    return {
      suggestedTier: 'BUSINESS',
      ...upgradePaths.ESSENTIALS.BUSINESS
    };
  }

  if (currentTier === 'PROFESSIONAL' && requiredTier === 'BUSINESS') {
    return {
      suggestedTier: 'BUSINESS',
      ...upgradePaths.PROFESSIONAL.BUSINESS
    };
  }

  return null;
}