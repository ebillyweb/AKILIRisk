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
| `tests/smoke/subdomain-routing.spec.ts` | "Subdomain Not Available" renders for both inactive-tenant (active+unverified) and disabled-tenant (verified+inactive) | TBD | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | wrong password shows credential error and stays on /signin | TBD | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | unauthenticated /dashboard sent to /signin with callbackUrl | TBD | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | client cannot reach /admin (redirected to dashboard) | TBD | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | client cannot reach /advisor (redirected to dashboard) | TBD | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | advisor cannot view admin content via direct /admin nav | TBD | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | advisor sees an unauthorized notice after attempting /admin | TBD | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | client sees an unauthorized notice after attempting /admin | TBD | Implemented |
| `tests/smoke/admin-intake-script.spec.ts` | admin intake script list renders with edit + visibility controls | TBD | Implemented |
| `tests/smoke/admin-intake-script.spec.ts` | admin can edit intake question; text round-trips through DB | TBD | Implemented |
| `tests/smoke/admin-intake-script.spec.ts` | admin can toggle visibility (DB round-trips) | TBD | Implemented |
| `tests/smoke/admin-intake-script.spec.ts` | visibility toggle updates the rendered counts without a hard reload | TBD | Implemented |
| `tests/smoke/advisor-logo-endpoint.spec.ts` | unauthenticated GET on /api/client/advisor-logo -> 401 | TBD | Implemented |
| `tests/smoke/advisor-logo-endpoint.spec.ts` | non-USER (admin) GET on /api/client/advisor-logo -> 403 | TBD | Implemented |
| `tests/smoke/advisor-logo-endpoint.spec.ts` | client GET returns image bytes with valid PNG/JPEG magic | TBD | Implemented |
| `tests/smoke/advisor-billing-gate.spec.ts` | advisor without active sub redirected to /advisor/billing on signin | TBD | Implemented |
| `tests/smoke/advisor-billing-gate.spec.ts` | /advisor + /advisor/pipeline + /advisor/dashboard all redirect no-sub advisor to billing | TBD | Implemented |
| `tests/smoke/default-branding-fallback.spec.ts` | client with brandingEnabled=false advisor sees the platform default | TBD | Implemented |
| `tests/smoke/advisor-intake-review.spec.ts` | advisor navigates pipeline -> /advisor/review/[id] and sees transcripts | TBD | Implemented |
| `tests/smoke/advisor-intake-review.spec.ts` | advisor cannot view another advisor's intake review via direct URL | TBD | Implemented |
| `tests/smoke/public-signup.spec.ts` | invite redemption + signup creates user that lands on /intake | TBD | Implemented |
| `tests/smoke/public-signup.spec.ts` | signup with existing email surfaces "Unable to create account" | TBD | Implemented |
| `tests/smoke/public-signup.spec.ts` | signup form rejects mismatched passwords | TBD | Implemented |

## Not Implemented (BRD Test Plan Coverage Gap)

Ordered roughly by BRD section. Fill in TC IDs and split into specs as work proceeds.

### Authentication & Access
- ~~Sign up with valid invite code (generic `123456`)~~ *(covered by `public-signup.spec.ts`)*
- ~~Sign up rejects mismatched passwords~~ *(covered by `public-signup.spec.ts`)*
- ~~Sign up with existing email surfaces an error~~ *(covered by `public-signup.spec.ts`)*
- Sign up with prefilled invite code (`BELV01`)
- Sign up rejects invalid/expired invite codes
- ~~Sign in rejects wrong password (error surfaces, no redirect)~~ *(covered by `auth-edge-cases.spec.ts`)*
- ~~Unauthenticated /dashboard redirected to /signin with callbackUrl~~ *(covered by `auth-edge-cases.spec.ts`)*
- ~~Client cannot reach /admin or /advisor (role gate)~~ *(covered by `auth-edge-cases.spec.ts`)*
- ~~Advisor cannot view admin content~~ *(covered by `auth-edge-cases.spec.ts`)*
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
- ~~Review client intake submission (transcripts on /advisor/review/[id])~~ *(covered by `advisor-intake-review.spec.ts`)*
- ~~Cross-advisor intake review URL is 404 (tenant isolation)~~ *(covered by `advisor-intake-review.spec.ts`)*
- Pipeline metrics (`activeInFlight`, `totalAssigned`) match expected counts
- Pipeline filters (by stage, search) update visible rows
- Send client invitation
- Approve/reject intake (action buttons in ReviewSidebar)
- View client assessment results
- Cyber risk advisor review
- Identity risk advisor review
- Intelligence advisor review
- Notification bell shows unread count
- Advisor billing page accessible when hub blocked
- Soft-deleted advisor: deactivated styling on admin advisors list

### Admin Functions
- ~~Admin can list advisors (`/admin/advisors`)~~ *(covered by `admin-advisors.spec.ts`)*
- ~~Admin intake script list renders with edit + visibility controls~~ *(covered by `admin-intake-script.spec.ts`)*
- ~~Admin can edit intake question text (DB round-trip)~~ *(covered by `admin-intake-script.spec.ts`)*
- ~~Admin can toggle question visibility (DB round-trip)~~ *(covered by `admin-intake-script.spec.ts`)*
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
- ~~Default Akili branding when client's advisor has `brandingEnabled=false`~~ *(covered by `default-branding-fallback.spec.ts`)*
- Default Akili branding when client has no active advisor assignment (different code path - findFirst returns null)
- ~~`/api/client/advisor-logo` returns advisor's actual S3 logo bytes~~ *(covered by `advisor-logo-endpoint.spec.ts`)*
- ~~`/api/client/advisor-logo` blocks non-USER and unauthenticated callers~~ *(covered by `advisor-logo-endpoint.spec.ts`)*
- Advisor branding edit flow (admin or advisor sets `brandName`/colors/logo, change is reflected in client portal)
- Advisor branding audit log entries created on update (`AdvisorBrandingAuditLog`)
- ~~`subscriptionQualifiesForPortalEnablement` gate: no-sub advisor redirected to `/advisor/billing`~~ *(covered by `advisor-billing-gate.spec.ts`)*
- Subscription edge states (UNPAID; CANCELLED with cancelAtPeriodEnd=true; expired GRACE_PERIOD)

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
- **Visibility toggle on `/admin/intake/questions` did not refresh** (487d209).
  `setIntakePillarQuestionVisibility` redirected to the same URL the form
  was submitted from, so the Next.js client router served the prefetched
  RSC payload and the user saw no UI update until manual refresh. Action
  now redirects to `/admin/intake/questions?saved=1` (different cache key,
  surfaces the existing success Alert). Regression test in
  `admin-intake-script.spec.ts` `visibility toggle updates the rendered
  counts without a hard reload` is now green.
- **`?error=unauthorized` set during cross-role redirects but never displayed** (a4ab170).
  Client navigating to `/admin` landed on `/dashboard?error=unauthorized`
  with no UI surfacing the param; advisor navigating to `/admin` lost the
  param entirely on the secondary `/dashboard` -> `/advisor` redirect. New
  `<UnauthorizedNotice />` client component renders a dismissible warning
  Alert when `error === "unauthorized"`; rendered on `/dashboard` and
  `/advisor`. Dashboard's role-router now forwards the query to
  `/advisor` and `/admin`. Regression tests in `auth-edge-cases.spec.ts`
  (`advisor sees an unauthorized notice...` + `client sees an unauthorized
  notice...`) cover both flows.

## Process

1. When implementing a new test, move its row from "Not Implemented" to "Implemented"
2. Fill in the BRD TC ID(s) it covers
3. If a test is added that has no BRD TC, leave the column blank but keep the row
4. If a feature is removed, delete the row outright (don't mark removed)
5. If functionality is changed or added, ensure it aligns with BRD
