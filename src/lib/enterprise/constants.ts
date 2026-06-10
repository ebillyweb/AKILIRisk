export const ENTERPRISE_DEFAULT_CLIENT_LIMIT = 100;

/** Default per-advisor client cap within an Enterprise firm. */
export const ENTERPRISE_DEFAULT_PER_ADVISOR_CLIENT_LIMIT = 25;

/** Default contracted advisor seats for new Enterprise contracts. */
export const ENTERPRISE_DEFAULT_SEAT_LIMIT = 25;

/** Denormalized Subscription.clientLimit fallback when tier is ENTERPRISE. */
export const ENTERPRISE_TIER_CLIENT_LIMIT = ENTERPRISE_DEFAULT_CLIENT_LIMIT;
