# E2E Test Inventory

Tracks which manual test cases from the **Akili Risk Test Plan** (BRD-derived,
~95 cases, stored in the user's Google Drive) are covered by Playwright tests
under `tests/`.

> **Note:** The BRD test plan document is not committed to this repo. TC IDs
> below should be filled in from the Google Drive doc as tests are implemented.
> Until then, tests are listed by feature area.

## Status Key
- **Implemented** - automated, runs in `tests/`
- **Not Implemented** - planned, no code yet
- **Failing** - implemented but currently red
- **Skipped** - implemented but disabled (note reason)

## Implemented

| Spec | Test | BRD TC ID(s) | Status |
|---|---|---|---|
| `tests/smoke/auth.spec.ts` | advisor can sign in and load `/advisor` | TBD | Implemented |
| `tests/smoke/auth.spec.ts` | client can sign in and load `/dashboard` | TBD | Implemented |
| `tests/smoke/auth.spec.ts` | admin can sign in and load `/admin` | TBD | Implemented |
| `tests/smoke/client-dashboard.spec.ts` | client dashboard reflects submitted intake state | TBD | Implemented |
| `tests/smoke/advisor-clients.spec.ts` | advisor can view client list and open a client | TBD | Implemented |
| `tests/smoke/admin-advisors.spec.ts` | admin can view advisors list with at least one row | TBD | Implemented |
| `tests/smoke/client-intake.spec.ts` | intake wizard end-to-end via Type tab (Q1..Q18 → /intake/complete) | TBD | Implemented |
| `tests/smoke/client-intake.spec.ts` | Next + Save disabled until response is typed | TBD | Implemented |
| `tests/smoke/client-portal-branding.spec.ts` | branded client sees advisor branding signals on /dashboard | TBD | Implemented |
| `tests/smoke/tenant-isolation.spec.ts` | advisor cannot open another advisor's client via direct URL | TBD | Implemented |
| `tests/smoke/subdomain-routing.spec.ts` | active subdomain serves the branded client portal | TBD | Implemented |
| `tests/smoke/subdomain-routing.spec.ts` | unverified subdomain shows "Subdomain Not Available" | TBD | Implemented |

## Not Implemented (BRD Test Plan Coverage Gap)

Ordered roughly by BRD section. Fill in TC IDs and split into specs as work proceeds.

### Authentication & Access
- Sign up with valid invite code (generic `123456`)
- Sign up with prefilled invite code (`BELV01`)
- Sign up rejects invalid/expired invite codes
- Sign in rejects wrong password (error surfaces, no redirect)
- Forgot password - request email
- Reset password from emailed link
- MFA enrollment flow (`/settings` Two-Factor)
- MFA challenge on sign in (`client-mfa@test.com`)
- Sign out clears session and redirects to `/signin`
- Deactivated account shows `notice=account_deactivated`
- Open-redirect protection on `callbackUrl`

### Client Intake
- ~~Intake "Type" tab happy path: 18 questions → submit → `/intake/complete`~~ *(covered by `client-intake.spec.ts`)*
- ~~Intake validation: Next + Save disabled until response saved~~ *(covered by `client-intake.spec.ts`)*
- Client starts intake from dashboard CTA (vs. direct `/intake` navigation)
- Intake "Voice" tab: AudioRecorder upload + transcription
- Intake save-and-resume across sessions (sign out mid-interview, sign back in, resume from last completed question)
- Submitted intake moves to `IN_REVIEW` state and surfaces on advisor's review queue
- Advisor approval unlocks assessment (`intakeGate.assessmentUnlocked`)
- Advisor rejection surfaces "Update needed" hero state on dashboard
- Advisor waiver path (intake skipped, assessment unlocked)

### Risk Assessments
- Governance question bank loads on assessment start
- Family risk module - complete and score
- Cyber risk module - complete and score
- Identity risk module - complete and score
- Intelligence module - complete and score
- Reputational & social module
- Physical risk module
- Resume in-progress assessment from dashboard
- Score persists and renders on dashboard
- Hidden questions (`questions.is_visible=false`) excluded

### Advisor Workflows
- ~~Advisor portfolio lists assigned clients~~ *(covered by `advisor-clients.spec.ts`)*
- ~~Open client detail from pipeline~~ *(covered by `advisor-clients.spec.ts`)*
- Pipeline metrics (`activeInFlight`, `totalAssigned`) match expected counts
- Pipeline filters (by stage, search) update visible rows
- Send client invitation
- Review client intake submission
- Approve/reject intake
- View client assessment results
- Cyber risk advisor review
- Identity risk advisor review
- Intelligence advisor review
- Notification bell shows unread count
- Advisor billing page accessible when hub blocked
- Soft-deleted advisor: deactivated styling on admin advisors list

### Admin Functions
- ~~Admin can list advisors (`/admin/advisors`)~~ *(covered by `admin-advisors.spec.ts`)*
- Admin can soft-delete an advisor
- Admin can list clients (`/admin/clients`)
- Admin can assign lead to advisor (`/admin/leads`)
- Admin intake management view (`/admin/intake`)
- Admin assessment management view (`/admin/assessment`)
- Admin question bank: hide/show question
- Admin question bank: edit copy
- Admin settings page renders
- Non-admin users redirected from `/admin/*` with `?error=unauthorized`

### Documents
- Generate PDF report for completed assessment
- Download report from dashboard
- Document templates render with branding

### Billing
- Free tier client onboarding
- Advisor subscribes to a tier (Stripe checkout)
- Subscription tier displayed on advisor admin row
- Billing cycle (monthly/annual) shown
- Grace period behavior on payment failure

### Branding & Multi-Tenant

> **Architectural note:** there is no `Tenant` model. Each `AdvisorProfile`
> is its own tenant unit. Branding lives on the advisor row
> (`brandName`, `firmName`, `tagline`, `primary/secondary/accentColor`,
> `logoUrl`/`logoS3Key`, `brandingEnabled`). The client portal pulls the
> client's assigned advisor's branding via `getAssignedAdvisorBrandingForClient`
> and applies it through `BrandingProvider` in `(protected)/layout.tsx`.

Implemented:
- ~~Client portal shows assigned advisor branding~~ *(covered by `client-portal-branding.spec.ts`)*
- ~~Cross-advisor data isolation on direct URL access~~ *(covered by `tenant-isolation.spec.ts`)*

Not Implemented (feature exists, not yet covered):
- Default Akili branding shown when client has no assigned advisor with `brandingEnabled`
- `/api/client/advisor-logo` returns the advisor's actual S3 logo bytes (not just 200)
- Advisor branding edit flow (admin or advisor sets `brandName`/colors/logo, change is reflected in client portal)
- Advisor branding audit log entries created on update (`AdvisorBrandingAuditLog`)
- `subscriptionQualifiesForPortalEnablement` gate: advisor without subscription redirected to `/advisor/billing`

Subdomain routing - exercisable via three staging-bound subdomains:
- `independent-wealth.akilirisk.com` -> advisor2, `isActive=true, dnsVerified=true` -> branded portal renders. *(covered by `subdomain-routing.spec.ts`)*
- `inactive-tenant.akilirisk.com` -> advisor3, `isActive=true, dnsVerified=false` -> "Subdomain Not Available". *(covered by `subdomain-routing.spec.ts`)*
- `disabled-tenant.akilirisk.com` -> advisor4, `isActive=false, dnsVerified=true` -> "Subdomain Not Available". *(covered by `subdomain-routing.spec.ts`)*

Not Implemented (subdomain/custom-domain features still pending):
- Reserved subdomain rejection (`www`, `app`, `api`, `admin` excluded by `extractSubdomain`). E2E test would require binding one of those names in Vercel which is invasive; consider a unit test against `extractSubdomain` instead.
- `customDomainEnabled` flag: routing logic for non-`*.akilirisk.com` hosts is not implemented in `proxy.ts` (flag-only, no domain mapping).
- Subdomain claim/validate/release UX (`generateSubdomainSuggestions`, `isSubdomainReserved`, `validateSubdomainFormat`).

Not Implemented (no such feature in the app):
- "Create tenant" admin flow - the platform has no tenant entity separate from `AdvisorProfile`

## State reset for stateful tests

The intake spec uses `client-fresh@test.com`, a seeded user with no
`IntakeInterview` row. Each happy-path run flips them to SUBMITTED, so the
spec runs `node scripts/reset-fresh-client-intake.js` in `beforeEach` to wipe
their interview rows (cascades drop `IntakeResponse` + `IntakeApproval`).

The reset script loads `DATABASE_URL` from `.env.local` then `.env` - same
order as the seed scripts. If your local env points at the staging Neon DB,
the reset hits staging. If you're running tests against `localhost:3000` with
a local DB, set the local `DATABASE_URL` accordingly.

To bootstrap a new machine: run `node scripts/seed-advisor-test-data.js` once.
The fresh-client section of that script is idempotent - re-running it leaves
the user in NOT_STARTED state.

## Surfaced bugs (filed during test writing)

_None outstanding. See "Fixed" below._

## Fixed

- **Branded portal `<title>` overridden by root metadata** (5184e47). Root
  metadata hard-coded "Belvedere Risk Management" so Next.js's Metadata API
  rendered it for every route, overriding the inline `<title>` in
  `branded/layout.tsx`. Replaced with a root `title.default + template` and a
  branded `generateMetadata` returning `title.absolute`. Regression test:
  `subdomain-routing.spec.ts` now asserts the page title matches the
  advisor's brandName on `independent-wealth.akilirisk.com`.
- **`/intake` landing copy said "10 focused questions" while the wizard
  rendered 18** (45dd46d). Landing now sources the count from
  `loadIntakeScriptQuestions()` - same loader the wizard uses - so admin
  changes to the pillar bank stay in sync.
- **`AdvisorSubdomain.isActive=false` path was unreachable** (0d5a142).
  `getAdvisorBySubdomain` short-circuited on `isActive`, so deactivated
  subdomains fell through to normal routing instead of the
  `proxy.ts`-served "Subdomain Not Available" page that already handled
  `dnsVerified=false`. Helper now returns the row whenever
  `brandingEnabled` is on and lets the proxy decide;
  `getAdvisorBrandingBySubdomain` gained a defensive guard so an inactive
  row can't render a portal even via a different code path. New seeded
  fixture (`advisor4` -> `disabled-tenant.akilirisk.com`,
  `isActive=false, dnsVerified=true`) and parameterized
  `subdomain-routing.spec.ts` cases keep both inactive states covered.

## Process

1. When implementing a new test, move its row from "Not Implemented" to "Implemented"
2. Fill in the BRD TC ID(s) it covers
3. If a test is added that has no BRD TC, leave the column blank but keep the row
4. If a feature is removed, delete the row outright (don't mark removed)
