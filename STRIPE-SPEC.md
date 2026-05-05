# Stripe Integration Specification

## Business Requirements

### Subscription Tiers

Per BRD §10.1 (round-9 alignment, 2026-05-04). The original rollout used
10/25/75; the values below are the current contract.

| Tier | Client Limit | Features | Target Market |
|------|--------------|----------|---------------|
| **Starter** | 25 clients | Basic reports | Solo advisors |
| **Growth** | 50 clients | Advanced reports | Small firms |
| **Professional** | 100 clients | All features, custom branding | Established practices |

### Billing Structure
- **Monthly billing**: Standard pricing
- **Annual billing**: 2-month discount (16.67% savings)
- **Client limits**: Hard limits with upgrade prompts
- **Overage handling**: Block new client creation, show upgrade modal
- **Grace period**: 14-day grace period for payment failures with email warnings

## Technical Implementation

### Database Schema

```sql
-- Add to Prisma schema
model Subscription {
  id                String   @id @default(cuid())
  userId            String   @unique
  stripeCustomerId  String   @unique
  stripePriceId     String
  stripeSubscriptionId String @unique
  tier              SubscriptionTier
  status            SubscriptionStatus
  clientLimit       Int
  billingCycle      BillingCycle
  currentPeriodEnd  DateTime
  cancelAtPeriodEnd Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  auditLogs         SubscriptionAuditLog[]
}

model SubscriptionAuditLog {
  id             String   @id @default(cuid())
  subscriptionId String
  action         String   // 'created', 'upgraded', 'downgraded', 'cancelled', 'payment_failed'
  previousTier   SubscriptionTier?
  newTier        SubscriptionTier?
  metadata       Json?
  timestamp      DateTime @default(now())

  subscription   Subscription @relation(fields: [subscriptionId], references: [id])
}

enum SubscriptionTier {
  STARTER
  GROWTH
  PROFESSIONAL
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  UNPAID
  GRACE_PERIOD
}

enum BillingCycle {
  MONTHLY
  ANNUAL
}
```

### API Architecture

#### Stripe Configuration
```typescript
// /src/lib/stripe.ts
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

export const STRIPE_PRICES = {
  STARTER_MONTHLY: 'price_starter_monthly',
  STARTER_ANNUAL: 'price_starter_annual',
  GROWTH_MONTHLY: 'price_growth_monthly',
  GROWTH_ANNUAL: 'price_growth_annual',
  PROFESSIONAL_MONTHLY: 'price_professional_monthly',
  PROFESSIONAL_ANNUAL: 'price_professional_annual',
}

export const TIER_LIMITS = {
  STARTER: 25,
  GROWTH: 50,
  PROFESSIONAL: 100,
} as const
```

#### Core Services
```typescript
// /src/lib/billing/subscription-service.ts
export class SubscriptionService {
  // Core methods
  async createSubscription(userId: string, tier: SubscriptionTier, billingCycle: BillingCycle)
  async upgradeSubscription(subscriptionId: string, newTier: SubscriptionTier)
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean)
  async checkClientLimit(userId: string): Promise<{ canAddClient: boolean, currentCount: number, limit: number }>
  async handlePaymentFailure(subscriptionId: string)
  async processGracePeriod(subscriptionId: string)

  // Cost optimization - batch operations
  async bulkCheckSubscriptionStatus(userIds: string[])
  async syncSubscriptionStatus(subscriptionId: string)
}
```

### UI Components

#### Billing Dashboard (`/src/components/advisor/billing/`)
- `SubscriptionOverview.tsx`: Current plan, usage, next billing date
- `PlanSelector.tsx`: Tier comparison and upgrade/downgrade options
- `UsageMonitor.tsx`: Client count vs limits, usage trends
- `BillingHistory.tsx`: Invoice list, download receipts
- `UpgradeModal.tsx`: Plan upgrade flow with Stripe Elements

#### Client Limit Enforcement
```typescript
// /src/components/advisor/ClientLimitGuard.tsx
export function ClientLimitGuard({ children }) {
  const { subscription, clientCount } = useSubscription()

  if (clientCount >= subscription.clientLimit) {
    return <UpgradePrompt currentTier={subscription.tier} />
  }

  return children
}
```

### Server Actions

```typescript
// /src/lib/actions/billing.ts
'use server'

export async function createCheckoutSession(tier: SubscriptionTier, billingCycle: BillingCycle)
export async function upgradeSubscription(newTier: SubscriptionTier)
export async function cancelSubscription(cancelAtPeriodEnd: boolean)
export async function getSubscriptionDetails(userId: string)
export async function getBillingHistory(userId: string)
```

## Security & Compliance

### PCI Compliance
- **No card storage**: All payment data handled by Stripe
- **Secure forms**: Stripe Elements for payment collection
- **API security**: Stripe webhook signature verification
- **Environment separation**: Test/production key isolation

### Audit Logging
```typescript
// Log all subscription events
await db.subscriptionAuditLog.create({
  data: {
    subscriptionId,
    action: 'upgraded',
    previousTier: 'STARTER',
    newTier: 'GROWTH',
    metadata: { triggeredBy: userId, source: 'web_app' },
  }
})
```

## Migration Strategy

### Round-9: BRD §10.1 alignment (2026-05-04)

**Status: applied via `prisma/migrations/20260504200000_tier_limit_bump_brd_alignment`.**

The current migration. Tier limits were 10 / 25 / 75 from the original
rollout; BRD §10.1 specifies 25 / 50 / 100. Aligned in code by bumping
`TIER_LIMITS` in `src/lib/billing/constants.ts`; aligned on existing rows
by the migration named above.

The migration uses a temp-table snapshot so the same view drives both the
UPDATE and the SubscriptionAuditLog INSERT in a single transaction. Each
bumped row gets one audit row with `action='tier_limit_bump'` and
`metadata={previousLimit, newLimit, source: 'brd_alignment_migration_20260504'}`.
Audit row ids are deterministic (`mig-tier-bump-<subscriptionId>`) so a
re-run after a partial rollback never double-writes audit rows.

The migration is idempotent: a `WHERE clientLimit != <new>` guard on the
snapshot means a re-run after full success is a no-op.

No Stripe Dashboard step was needed — Stripe products/prices don't carry
the limit; it lives only in code + the row.

The audit rows surface in `/admin/audit-log` (round-7 admin UI) under
action `subscription.tier_limit_bump` via the round-8 unified read view.

### Historical: original tier-rollout plan

The original tier-rollout migration plan from when STRIPE-SPEC.md was
first written. Captured here for context — the 25/75 numbers below reflect
the *original* tier limits, which the round-9 migration above has since
bumped to the BRD-aligned values.

1. **Data migration**: Create Subscription records for existing ADVISOR users
2. **Default tier**: Auto-enroll in Growth plan (was 25 clients; now 50)
3. **Grace period**: 30-day free period to choose plan
4. **Client count handling**: If advisor has >25 clients (under the original
   limits), auto-assign Professional tier

```sql
-- Original migration script (kept for context — supersede with the round-9
-- migration above when adapting for current code).
INSERT INTO Subscription (userId, tier, status, clientLimit, billingCycle, currentPeriodEnd)
SELECT
  u.id,
  CASE
    WHEN client_count > 25 THEN 'PROFESSIONAL'
    ELSE 'GROWTH'
  END,
  'GRACE_PERIOD',
  CASE
    WHEN client_count > 25 THEN 75
    ELSE 25
  END,
  'MONTHLY',
  NOW() + INTERVAL '30 days'
FROM User u
WHERE u.role = 'ADVISOR'
```

## Cost Optimization

### API Call Minimization
- **Batch operations**: Sync multiple subscriptions in single request
- **Caching**: Cache subscription status locally with TTL
- **Lazy loading**: Only fetch billing details when billing page accessed
- **Stripe Elements**: Reuse payment elements across sessions

### Webhook Alternative
Since webhooks aren't used, implement periodic sync:
```typescript
// Cron job: sync critical subscription status every hour
export async function syncCriticalSubscriptions() {
  const expiringSoon = await db.subscription.findMany({
    where: {
      currentPeriodEnd: { lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      status: 'ACTIVE'
    }
  })

  // Batch check with Stripe
  await Promise.all(expiringSoon.map(sub => SubscriptionService.syncSubscriptionStatus(sub.id)))
}
```

## Error Handling

### Payment Failures
1. **Grace period**: 14 days with daily email reminders
2. **Feature degradation**: Remove premium features, maintain client access
3. **Recovery flow**: Simple payment update process
4. **Admin notification**: Alert admins of accounts at risk

### Client Limit Enforcement
```typescript
export async function enforceClientLimit(userId: string) {
  const check = await SubscriptionService.checkClientLimit(userId)

  if (!check.canAddClient) {
    throw new ClientLimitError(
      `Client limit reached (${check.currentCount}/${check.limit}). Please upgrade your subscription.`,
      { currentTier: subscription.tier, upgradeUrl: '/billing/upgrade' }
    )
  }
}
```

## Testing Strategy

### Stripe Test Mode
- **Test cards**: Use Stripe test cards for all payment flows
- **Test scenarios**: Success, decline, expired card, 3DS authentication
- **Webhook testing**: Use Stripe CLI for local webhook testing (if added later)

### Key Test Cases
1. **Subscription creation**: New advisor signup with immediate billing
2. **Tier upgrades**: Mid-cycle upgrades with prorations
3. **Client limits**: Block creation when limit reached, show upgrade
4. **Payment failures**: Grace period activation, recovery flows
5. **Cancellations**: Immediate vs end-of-period cancellation

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Database schema migration
- Stripe configuration and test products
- Basic subscription service implementation

### Phase 2: Core Billing (Week 3-4)
- Subscription creation and management APIs
- Client limit enforcement
- Basic billing dashboard

### Phase 3: Advanced Features (Week 5-6)
- Usage monitoring and analytics
- Billing history and invoice download
- Email notifications for billing events

### Phase 4: Migration & Polish (Week 7-8)
- Existing advisor migration
- Comprehensive testing
- Performance optimization and monitoring

## Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # or sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_test_... # or pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_... # if webhooks added later

# Application Settings
BILLING_GRACE_PERIOD_DAYS=14
DEFAULT_MIGRATION_TIER=GROWTH
ENABLE_BILLING_FEATURES=true
```

## Success Metrics

- **Conversion rate**: Trial to paid subscription conversion
- **Upgrade rate**: Percentage of users upgrading tiers
- **Churn rate**: Monthly/annual subscription cancellations
- **Support load**: Billing-related support tickets
- **API costs**: Stripe API call volume and costs