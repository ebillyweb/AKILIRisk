# Epic 5.7 — Billing, Branding & White-Label

**Status:** **Code-only** → stories US-39–US-42 proposed  
**BRD alignment:** FR-11 (subscription), BRAND-* (v1.4), white-label subdomains

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-39 | Subscribe and manage billing | **Code-only** | Stripe, `/advisor/billing` |
| US-40 | Enforce client limit by plan | **Done** | Epic 5.1 US-2 at invite time |
| US-41 | Configure advisor branding | **Code-only** | Logo, colors, firm name |
| US-42 | Serve tenant on custom subdomain | **Code-only** | Staging + production hosts |

---

## US-39 — Manage Advisor Subscription (Advisor)

| Capability | Implementation |
|------------|----------------|
| Billing portal / checkout | `/advisor/billing`, Stripe integration |
| Subscription status gate | Billing gate for unverified/inactive tenants |

**Code:** `src/lib/billing/**`, `src/app/(protected)/advisor/billing/page.tsx`

**Test fixtures:** `advisor3@test.com` (unverified), `advisor4@test.com` (deactivated) — see CLAUDE.md

---

## US-40 — Enforce Client Limit at Invite (System)

**Status: Done** — documented in [Epic 5.1 US-2](./EPIC-5.1-client-invitation-onboarding.md#us-2--enforce-subscription-client-limit-at-invite-time-system)

**Reconciliation:** Single implementation (`assertCanAddClientForAdvisorProfile`); story lives in 5.1, billing epic cross-links here.

---

## US-41 — Configure Firm Branding (Advisor)

| Capability | Implementation |
|------------|----------------|
| Branding toggle and assets | Advisor settings, `brandingEnabled` |
| Branded emails | Epic 5.1 US-3 / US-1B |
| Branded client portal | Dashboard / document portal theming |
| Co-branded PDF reports | Report `brandingSnapshot` on publish (Epic 5.2 US-20) |
| Branded invitation links | `buildInvitationSignupUrl` on tenant host |

**Code:** `src/lib/validation/branding.ts`, advisor settings components

**Tests:** `tests/smoke/client-portal-branding.spec.ts`, `default-branding-fallback` patterns

---

## US-42 — Access Platform on Advisor Subdomain (Client / Advisor)

| Capability | Implementation |
|------------|----------------|
| Tenant subdomain routing | `src/proxy.ts`, `platform-subdomain.ts` |
| Claim / verify subdomain | `/api/advisor/subdomain/claim` |
| Staging suffix `-staging` | Env `TENANT_SUBDOMAIN_SUFFIX` |

**Docs:** [white-label-subdomains.md](../white-label-subdomains.md)

**Reconciliation:** Invite links should target tenant host when branding enabled (US-1B).

---

## Playwright coverage

| Area | Status |
|------|--------|
| Client portal branding | `client-portal-branding.spec.ts` |
| Billing gate / subdomain | **Partial** — fixture users exist; dedicated specs TBD |

## Related

- [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md)
- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — co-branded report PDF
