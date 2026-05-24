# E2E Test Inventory

Tracks which manual test cases from the **Akili Risk Test Plan** (BRD-derived,
~95 cases, stored in the user's Google Drive) are covered by Playwright tests
under `tests/`.

**Epic & story mapping:** [docs/user-stories/README.md](../docs/user-stories/README.md)  
Canonical assessment path: **Epic 5.2** (US-10 – US-20). Legacy module tests below should align with [Epic 5.9](../docs/user-stories/EPIC-5.9-extended-risk-modules.md) reconciliation.

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
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | US-28 pipeline search + stalled URL filter | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | US-34 cross-advisor intelligence detail blocked | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | US-35 notification preferences page | Epic 5.4 | Implemented |
| `tests/smoke/public-signup.spec.ts` | invite redemption + signup creates user that lands on /intake | TBD | Implemented |
| `tests/smoke/public-signup.spec.ts` | signup with existing email surfaces "Unable to create account" | TBD | Implemented |
| `tests/smoke/public-signup.spec.ts` | signup form rejects mismatched passwords | TBD | Implemented |
| `tests/smoke/intake-audio-endpoint.spec.ts` | owner client GET on /api/intake/[id]/audio/[questionId] returns audio bytes (200) | TBD | Implemented |
| `tests/smoke/intake-audio-endpoint.spec.ts` | assigned advisor GET returns audio bytes (200) | TBD | Implemented |
| `tests/smoke/intake-audio-endpoint.spec.ts` | unassigned advisor GET returns 404 (cross-tenant audio isolation) | TBD | Implemented |
| `tests/smoke/intake-audio-endpoint.spec.ts` | unauthenticated GET returns 401 | TBD | Implemented |
| `tests/smoke/stripe-webhook-endpoint.spec.ts` | same event.id delivered twice is deduped (idempotency) | TBD | Implemented |
| `tests/smoke/stripe-webhook-endpoint.spec.ts` | bad signature returns 400 and creates no dedupe row | TBD | Implemented |
| `tests/smoke/stripe-webhook-endpoint.spec.ts` | two parallel deliveries of same event.id → exactly one is processed (atomic claim) | TBD | Implemented |
| `tests/smoke/audit-log-access.spec.ts` | admin can view /admin/audit-log; meta-audit row appears on reload | TBD | Implemented |
| `tests/smoke/audit-log-access.spec.ts` | advisor / client / unauthenticated → 404 on /admin/audit-log (no existence leak) | TBD | Implemented |
| `tests/smoke/audit-log-access.spec.ts` | unauthenticated GET /api/admin/audit-log/export → 404 | TBD | Implemented |
| `tests/smoke/audit-log-wiring.spec.ts` | admin create advisor → user.create row with redacted password + emailHash + before=null | TBD | Implemented |
| `tests/smoke/audit-log-wiring.spec.ts` | admin soft-delete advisor → user.soft_delete row with deletedAt + portal access diff | TBD | Implemented |
| `tests/smoke/audit-log-csv-export.spec.ts` | admin downloads CSV; rows parse; column count matches header | TBD | Implemented |
| `tests/smoke/audit-log-csv-export.spec.ts` | export action self-audits as data_access.export with filterHash + format=csv | TBD | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-1 send + email normalize; US-9 filters/expire; US-8 resend | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-5 opened API; US-6 invalid invite + register 410; US-7 redeem → intake/assessment | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-4 shareable link when email send fails (send + resend) | Epic 5.1 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | US-12 approved client sees six pillar cards on /assessment | US-10–20 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | US-12 client opens governance pillar questionnaire | US-10–20 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | US-12 hub entry for governance + cyber-digital pillars | US-10–20 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | US-12 gate: client without approved intake redirected from /assessment | US-10–20 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | US-12 intake-waived invite shows six pillar hub | US-10–20 | Implemented |
| `tests/smoke/epic-5.2-advisor-intake-approval.spec.ts` | US-11 advisor approves intake → client sees six pillars | US-11 | Implemented |
| `tests/smoke/epic-5.2-advisor-intake-approval.spec.ts` | US-11 advisor rejects intake → client blocked from /assessment | US-11 | Implemented |
| `tests/smoke/epic-5.2-report-publish.spec.ts` | US-20 client PDF 404 before publish | US-19–20 | Implemented |
| `tests/smoke/epic-5.2-report-publish.spec.ts` | US-19–20 advisor publish → client PDF download | US-19–20 | Implemented |
| `tests/smoke/epic-5.2-assessment-progress.spec.ts` | US-13 governance maturity scale four levels + selection | US-13 | Implemented |
| `tests/smoke/epic-5.2-assessment-progress.spec.ts` | US-14 resume after sign-out; server beats stale localStorage | US-14 | Implemented |
| `tests/smoke/epic-5.2-dashboard-heatmap.spec.ts` | US-16 six-cell heat map after scoring | US-16 | Implemented |
| `tests/smoke/epic-5.2-dashboard-heatmap.spec.ts` | US-16 empty heat map before scoring | US-16 | Implemented |
| `tests/smoke/epic-5.3-household-profiles.spec.ts` | US-21 client adds household member | Epic 5.3 | Implemented |
| `tests/smoke/epic-5.3-household-profiles.spec.ts` | US-48 hidden member omitted from advisor intake review | Epic 5.3 | Implemented |
| `tests/smoke/epic-5.3-household-profiles.spec.ts` | US-49 advisor disables profiles → client nav hidden + notice | Epic 5.3 | Implemented |

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
- Intake "Voice" tab: AudioRecorder upload + transcription *(upload + auth-gated playback covered by `intake-audio-endpoint.spec.ts`; transcription pipeline itself still uncovered)*
- Intake save-and-resume across sessions (sign out mid-interview, sign back in, resume from last completed question)
- Submitted intake moves to `IN_REVIEW` state and surfaces on advisor's review queue
- ~~Advisor approval unlocks assessment (`intakeGate.assessmentUnlocked`)~~ *(covered by `epic-5.2-advisor-intake-approval.spec.ts`)*
- Advisor rejection surfaces "Update needed" hero state on dashboard *(reject gate covered; dashboard hero copy TBD)*
- ~~Advisor waiver path (intake skipped, assessment unlocked)~~ *(partial: waived invite hub in `six-pillar-assessment.spec.ts`)*

### Risk Assessments (Epic 5.2 — six pillars)
- ~~Six-pillar hub loads for assessment-unlocked client~~ *(covered by `six-pillar-assessment.spec.ts`)*
- ~~Governance question bank loads on assessment start~~ *(covered by `six-pillar-assessment.spec.ts`)*
- Score all six pillars → assessment `COMPLETED` (US-15) *(via `/api/test/assessment/prepare` in report smokes)*
- Client resilience / heat map after multi-pillar score (US-16)
- ~~Full flow: score → advisor draft report → publish → client PDF download (US-19–20)~~ *(covered by `epic-5.2-report-publish.spec.ts`)*
- ~~Resume in-progress assessment from dashboard (US-14)~~ *(covered by `epic-5.2-assessment-progress.spec.ts`)*
- ~~US-13 maturity scale on governance question~~ *(covered by `epic-5.2-assessment-progress.spec.ts`)*
- ~~US-16 dashboard heat map populated / empty~~ *(covered by `epic-5.2-dashboard-heatmap.spec.ts`)*
- Hidden questions (`questions.is_visible=false`) excluded
- Orphan cleanup when branching hides answered question (US-14)

### Legacy / extended modules (Epic 5.9 — reconcile before expanding coverage)
- Family risk module - complete and score *(legacy monolith; client redirects to governance)*
- Cyber risk module - complete and score *(use `cyber-digital` pillar instead)*
- Identity risk module - complete and score *(legacy; redirects to governance)*
- Intelligence module - complete and score *(advisor portfolio analytics, not client questionnaire)*
- Reputational & social module *(pillar: `reputational-social`)*
- Physical risk module *(pillar: `physical-security`)*

### Advisor Workflows
- ~~Advisor portfolio lists assigned clients~~ *(covered by `advisor-clients.spec.ts`)*
- ~~Open client detail from pipeline~~ *(covered by `advisor-clients.spec.ts`)*
- ~~Review client intake submission (transcripts on /advisor/review/[id])~~ *(covered by `advisor-intake-review.spec.ts`)*
- ~~Cross-advisor intake review URL is 404 (tenant isolation)~~ *(covered by `advisor-intake-review.spec.ts`)*
- ~~Pipeline metrics (`activeInFlight`, `totalAssigned`) match expected counts~~ *(partial: Vitest stage/doc counts; no Playwright DB assert)*
- ~~Pipeline filters (by stage, search) update visible rows~~ *(covered by `epic-5.4-advisor-workspace.spec.ts` search + stalled filter)*
- Full client document upload E2E (S3)
- Cron reminder jobs (needs `CRON_SECRET` + fixtures)
- ~~Send client invitation~~ *(covered by `client-invitation-onboarding.spec.ts`)*
- Approve/reject intake (action buttons in ReviewSidebar) *(covered by `epic-5.2-advisor-intake-approval.spec.ts`)*
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
- ~~Admin can soft-delete an advisor (verifies user.soft_delete audit row)~~ *(covered by `audit-log-wiring.spec.ts`)*
- Admin can list clients (`/admin/clients`)
- Admin can assign lead to advisor (`/admin/leads`)
- Admin intake management view (`/admin/intake`)
- Admin assessment management view (`/admin/assessment`)
- Admin question bank: hide/show question
- Admin question bank: edit copy
- Admin settings page renders
- Non-admin users redirected from `/admin/*` with `?error=unauthorized`
- ~~Admin audit log (`/admin/audit-log`) — view, filter, paginate, CSV export~~ *(covered by `audit-log-access.spec.ts`, `audit-log-wiring.spec.ts`, `audit-log-csv-export.spec.ts`)*

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

Subdomain routing (see `docs/white-label-subdomains.md`). Seeded **slugs**; Playwright builds hosts with `TENANT_SUBDOMAIN_SUFFIX` (default `-staging` when `PLAYWRIGHT_BASE_URL` is `preview.akilirisk.com`):
- `independent-wealth` (+ suffix) -> advisor2, active+verified -> branded portal. *(covered by `subdomain-routing.spec.ts`)*
- `inactive-tenant` (+ suffix) -> advisor3, not verified -> "Subdomain Not Available". *(covered by `subdomain-routing.spec.ts`)*
- `disabled-tenant` (+ suffix) -> advisor4, inactive -> "Subdomain Not Available". *(covered by `subdomain-routing.spec.ts`)*

Implemented (subdomain):
- Claim / check / release UX and API (`SubdomainManager`, `/api/advisor/subdomain/*`).
- Platform-owned activation (`SUBDOMAIN_AUTO_ACTIVATE`), staging suffix (`TENANT_SUBDOMAIN_SUFFIX`).
- Reserved labels in code + optional `scripts/seed-platform-reserved-subdomains.js`.
- Unit tests: `src/lib/advisor/platform-subdomain.test.ts`.

Not Implemented (subdomain/custom-domain):
- `customDomainEnabled`: bring-your-own domain routing (non-`*.akilirisk.com`).
- Per-advisor DNS verification jobs (not needed for platform-owned zone).

Not Implemented (no such feature in the app):
- "Create tenant" admin flow - the platform has no tenant entity separate from `AdvisorProfile`

## State reset for stateful tests

The intake spec uses `client-fresh@test.com`, a seeded user with no
`IntakeInterview` row. Each happy-path run flips them to SUBMITTED, so the
spec runs `node scripts/reset-fresh-client-intake.js` in `beforeEach` to wipe
their interview rows (cascades drop `IntakeResponse` + `IntakeApproval`).

The reset script loads `DATABASE_URL` from `.env.local` at the repo root (same
pattern as the seed scripts). If your local env points at the staging Neon DB,
the reset hits staging. If you're running tests against `localhost:3000` with
a local DB, set the local `DATABASE_URL` accordingly.

To bootstrap a new machine: run `node scripts/seed-advisor-test-data.js` once.
The fresh-client section of that script is idempotent - re-running it leaves
the user in NOT_STARTED state.

## Surfaced bugs (filed during test writing)

_None outstanding. See "Fixed" below._

## Fixed

- **Branded portal `<title>` overridden by root metadata** (5184e47). Root
  metadata hard-coded "AKILI Risk Management" so Next.js's Metadata API
  rendered it for every route, overriding the inline `<title>` in
  `branded/layout.tsx`. Replaced with a root `title.default + template` and a
  branded `generateMetadata` returning `title.absolute`. Regression test:
  `subdomain-routing.spec.ts` now asserts the page title matches the
  advisor's brandName on the active tenant host (`independent-wealth` + `TENANT_SUBDOMAIN_SUFFIX`).
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
  fixture (`advisor4` -> slug `disabled-tenant`,
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
