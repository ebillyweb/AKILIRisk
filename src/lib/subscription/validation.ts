import { prisma } from '@/lib/db';
import { LOGO_MAX_BYTES, SubscriptionFeatures } from '@/lib/validation/branding';

/**
 * Feature mapping by subscription tier.
 * Temporarily: all paid tiers get the full branding surface (UI, PDF, subdomain).
 */
const TIER_FEATURES = {
  STARTER: {
    basicBrandingEnabled: true,
    advancedBrandingEnabled: true,
    customSubdomainEnabled: true,
    whiteLabel: true,
  },
  GROWTH: {
    basicBrandingEnabled: true,
    advancedBrandingEnabled: true,
    customSubdomainEnabled: true,
    whiteLabel: true,
  },
  PROFESSIONAL: {
    basicBrandingEnabled: true,
    advancedBrandingEnabled: true,
    customSubdomainEnabled: true,
    whiteLabel: true,
  },
} as const;

/** Used when no billing row exists yet (e.g. local dev) so advisor branding UI still loads.
 *  Do NOT use directly as a fallback in production code paths — see
 *  `missingSubscriptionFallback` below, which fails closed in production. */
export const STARTER_SUBSCRIPTION_FEATURES: SubscriptionFeatures = {
  tier: 'STARTER',
  ...TIER_FEATURES.STARTER,
};

/** Fail-closed entitlement set: every paid feature off. Returned in production
 *  when no Subscription row is found (or `getSubscriptionFeatures` errored).
 *  `tier: 'STARTER'` is just a label so the type checks; every feature is false. */
export const NO_SUBSCRIPTION_FEATURES: SubscriptionFeatures = {
  tier: 'STARTER',
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
    : STARTER_SUBSCRIPTION_FEATURES;
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
  const caps = TIER_FEATURES[subscription.tier] ?? TIER_FEATURES.STARTER;
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
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        tier: true,
      },
    });

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
export function getFeatureLimits(tier: 'STARTER' | 'GROWTH' | 'PROFESSIONAL') {
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
    STARTER: professional,
    GROWTH: professional,
    PROFESSIONAL: professional,
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
      tierLimits = { STARTER: 3, GROWTH: 3, PROFESSIONAL: 3 };
      break;
    case 'logo_upload':
      actionType = 'UPLOAD_LOGO';
      tierLimits = { STARTER: 20, GROWTH: 20, PROFESSIONAL: 20 };
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

  const tier = advisor.user.subscription?.tier ?? 'STARTER';
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
  currentTier: 'STARTER' | 'GROWTH' | 'PROFESSIONAL',
  requestedFeature: string
): {
  suggestedTier: 'GROWTH' | 'PROFESSIONAL' | null;
  features: string[];
  message: string;
} | null {
  const upgradePaths = {
    STARTER: {
      GROWTH: {
        features: [
          'Custom brand colors',
          'Custom subdomain',
          'Extended branding fields',
          'Priority support'
        ],
        message: 'Upgrade to Growth to unlock advanced branding features and custom subdomain.'
      },
      PROFESSIONAL: {
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
    GROWTH: {
      PROFESSIONAL: {
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
    'advancedBrandingEnabled': 'GROWTH',
    'customSubdomainEnabled': 'GROWTH',
    'whiteLabel': 'PROFESSIONAL',
  };

  const requiredTier = featureRequirements[requestedFeature as keyof typeof featureRequirements];
  if (!requiredTier) return null;

  if (currentTier === 'STARTER' && requiredTier === 'GROWTH') {
    return {
      suggestedTier: 'GROWTH',
      ...upgradePaths.STARTER.GROWTH
    };
  }

  if (currentTier === 'STARTER' && requiredTier === 'PROFESSIONAL') {
    return {
      suggestedTier: 'PROFESSIONAL',
      ...upgradePaths.STARTER.PROFESSIONAL
    };
  }

  if (currentTier === 'GROWTH' && requiredTier === 'PROFESSIONAL') {
    return {
      suggestedTier: 'PROFESSIONAL',
      ...upgradePaths.GROWTH.PROFESSIONAL
    };
  }

  return null;
}