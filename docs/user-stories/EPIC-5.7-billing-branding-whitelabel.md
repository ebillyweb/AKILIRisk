# Epic 5.7 — Billing, Branding & White-Label

**Status:** Implemented (core flows)  
**BRD alignment:** FR-8 (advisor commercial / portal access), BRAND-* (v1.4), white-label subdomains

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-55 | Subscribe to an Advisor Plan | **Done** | Stripe Checkout, tier limits 25/50/100 |
| US-56 | Change or Manage Subscription | **Done** | Prorated plan switch, Customer Portal, invoices |
| US-57 | Reconcile subscription from provider | **Done** | Webhook idempotency + fail-closed status map |
| US-58 | New-advisor grace period | **Done** | Admin create + 30-day paid-signup enforcement |
| US-59 | Configure firm branding | **Done** | Logo up to 5 MB, private S3 proxy for clients |
| US-60 | Claim white-label subdomain | **Done** | 3–20 chars, reserved labels, 3 changes / 24h |
| US-61 | Serve branded client portal | **Done** | `src/proxy.ts`, active + verified only |

**Cross-epic:** Client limit at invite — [Epic 5.1 US-2](./EPIC-5.1-client-invitation-onboarding.md#us-2--enforce-subscription-client-limit-at-invite-time-system) (`assertCanAddClientForAdvisorProfile`).

---

## US-55 — Subscribe to an Advisor Plan (Advisor)

| Acceptance | Implementation |
|------------|----------------|
| Tier + cycle → subscription + client limit | `TIER_LIMITS`, `upsertSubscriptionFromStripe`, Checkout metadata |
| Checkout → **ACTIVE** | Webhook `checkout.session.completed`, `mapStripeSubscriptionStatus("active")` |
| Billing on, no qualifying sub → no hub | `getAdvisorHubAccessForUserId`, `(protected)/advisor/layout.tsx` → `/advisor/billing` |

**Code:** `src/lib/billing/**`, `src/lib/actions/billing.ts`, `src/app/(protected)/advisor/billing/page.tsx`

**Tests:** `tests/smoke/advisor-billing-gate.spec.ts`

---

## US-56 — Change or Manage Subscription (Advisor)

| Acceptance | Implementation |
|------------|----------------|
| Tier/cycle change, proration, limit update | `switchSubscriptionPlan` (`proration_behavior: "create_prorations"`) |
| Billing portal, invoices | `createPortalSession`, `getBillingHistory` |

**UI:** `src/components/advisor/billing/BillingDashboard.tsx`

---

## US-57 — Reconcile Subscription Status (System)

| Acceptance | Implementation |
|------------|----------------|
| Process events once | `claimWebhookEvent` on `StripeWebhookEvent.id` |
| Payment failure → PAST_DUE / UNPAID | `mapStripeSubscriptionStatus`, `invoice.payment_failed` |
| Unknown Stripe status → UNPAID | `stripe-status.ts` default arm |

**Code:** `src/app/api/webhooks/stripe/route.ts`, `src/lib/billing/subscription-service.ts`

**Tests:** `tests/smoke/stripe-webhook-endpoint.spec.ts`, `src/lib/billing/stripe-status.test.ts`

**Policy — PAST_DUE portal access:** Advisors retain hub access while `PAST_DUE` (aligned with STRIPE-SPEC payment-failure grace / `BILLING_GRACE_PERIOD_DAYS`). Client adds use the same rule in `subscriptionAllowsNewClients`. UNPAID blocks access.

---

## US-58 — New-Advisor Grace Period (Advisor)

| Acceptance | Implementation |
|------------|----------------|
| Admin create → Growth (50), welcome email | `createAdvisorByAdmin`, `buildNewAdvisorWelcomeEmailHtml` |
| Grace ends 00:00 UTC next day; 30 days paid signup | `newAdvisorGracePeriodEndsAt`, `newAdvisorPaidSignupDeadline` |
| After grace, no paid sub → blocked | `subscriptionQualifiesForPortalEnablement` + `isPastPaidSignupDeadline` |

**Code:** `src/lib/billing/new-advisor-grace.ts`, `src/lib/billing/advisor-portal-subscription.ts`

**Tests:** `src/lib/billing/new-advisor-grace.test.ts`, `src/lib/billing/advisor-portal-subscription.test.ts`

---

## US-59 — Configure Firm Branding (Advisor)

| Acceptance | Implementation |
|------------|----------------|
| Logo, colors, tagline on portal + reports | `BrandingProvider`, `brandingSnapshot`, PDF routes |
| Logo ≤ 5 MB, private storage | `LOGO_MAX_BYTES`, S3 + `/api/client/advisor-logo` |
| No branding / disabled → Akili lockup | `brandingEnabled`, `default-branding-fallback.spec.ts` |

**Code:** `src/lib/validation/branding.ts`, `src/lib/s3/branding-uploads.ts`, advisor settings

**Tests:** `tests/smoke/client-portal-branding.spec.ts`, `tests/smoke/default-branding-fallback.spec.ts`

---

## US-60 — Claim White-Label Subdomain (Advisor)

| Acceptance | Implementation |
|------------|----------------|
| 3–20 chars, lowercase alphanumeric + hyphens, not reserved | `subdomainClaimSchema`, `PLATFORM_SUBDOMAIN_LABELS` |
| 3 changes / 24h | `checkRateLimit(..., 'subdomain_change', 24)` |
| Active or pending + DNS instructions | `SUBDOMAIN_AUTO_ACTIVATE`, `SubdomainManager` |

**Code:** `src/app/api/advisor/subdomain/claim/route.ts`, `src/lib/advisor/platform-subdomain.ts`

**Tests:** `src/lib/subscription/rate-limit.test.ts`, `src/lib/advisor/platform-subdomain.test.ts`

---

## US-61 — Serve Branded Client Portal (System)

| Acceptance | Implementation |
|------------|----------------|
| Active + verified subdomain → branded portal | `src/proxy.ts` rewrite to `/branded/*` |
| Inactive / unverified → not served | 404 “Subdomain Not Available” |
| Platform hostname → main app | `isPlatformHostname` |

**Docs:** [white-label-subdomains.md](../white-label-subdomains.md)

**Tests:** `tests/smoke/subdomain-routing.spec.ts`

**Fixtures:** `advisor2` (active+verified), `advisor3` (unverified), `advisor4` (inactive) — CLAUDE.md

---

## Playwright / unit coverage

| Area | Spec / test file |
|------|------------------|
| Billing gate | `advisor-billing-gate.spec.ts` |
| Client branding + fallback | `client-portal-branding.spec.ts`, `default-branding-fallback.spec.ts` |
| Subdomain routing | `subdomain-routing.spec.ts` |
| Stripe webhooks | `stripe-webhook-endpoint.spec.ts` |
| Portal qualification / grace | `advisor-portal-subscription.test.ts` |
| Subdomain rate limit | `rate-limit.test.ts` |

## Related

- [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md) — invites, branded signup URLs
- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — co-branded report PDF
