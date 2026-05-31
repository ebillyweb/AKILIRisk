# E2E Test Inventory

Tracks which manual test cases from the **Akili Risk Test Plan** (BRD-derived,
~95 cases, stored in the user's Google Drive) are covered by Playwright tests
under `tests/`.

**Epic & story mapping:** [docs/user-stories/README.md](../docs/user-stories/README.md)  
Canonical assessment path: **Epic 5.2** (US-10 – US-20). Legacy module tests below should align with [Epic 5.9](../docs/user-stories/EPIC-5.9-extended-risk-modules.md) reconciliation.

**Current suite:** **141** Playwright tests in **38** spec files under `tests/smoke/`. Regenerate the list with `npx playwright test --list`.

> **Note:** The BRD test plan document is not committed to this repo. TC IDs
> below should be filled in from the Google Drive doc as tests are implemented.
> Until then, tests are listed by feature area.

## Status Key
- **Implemented** - automated, runs in `tests/`
- **Not Implemented** - planned, no code yet
- **Failing** - implemented but currently red
- **Skipped** - implemented but disabled (note reason)

## Last preview run

Target: `https://preview.akilirisk.com` (2026-05-27, local runner)

| Result | Count |
|--------|------:|
| Passed | 83 |
| Failed | 55 |
| Skipped | 3 |
| **Total** | **141** |

| Epic / area | Pass | Fail | Skip |
|-------------|-----:|-----:|-----:|
| 5.1 Public / onboarding | 21 | 2 | 0 |
| 5.2 Assessment lifecycle | 0 | 19 | 0 |
| 5.3 Household profiles | 0 | 3 | 0 |
| 5.4 Advisor workspace | 9 | 5 | 0 |
| 5.5 Platform admin | 36 | 6 | 0 |
| 5.6 Security / compliance | 9 | 14 | 0 |
| 5.7 Branding / tenants | 7 | 5 | 0 |
| 5.8 Policy templates | 1 | 1 | 0 |
| Billing / Stripe | 0 | 0 | 3 |

**Failure themes (preview):**
- **Client auth timeouts** — many client specs never reach `/dashboard` (magic-link verify or post-login redirect; likely **PII consent gate** at `/consent/pending` and/or `auth.spec.ts` still using password sign-in for clients instead of `signInAs`).
- **Admin/advisor UI drift** — heading/locator mismatches on admin sign-in, audit-log 404 expectations, advisor pipeline/review pages.
- **Env-conditional skips (expected):** Stripe webhook suite skipped without `STRIPE_WEBHOOK_SECRET` + remote flag; cron/S3 tests may skip without `CRON_SECRET` / AWS creds.

Re-run locally: `PLAYWRIGHT_BROWSERS_PATH=./.playwright-browsers npm run test:e2e` (install browsers once with `PLAYWRIGHT_BROWSERS_PATH=./.playwright-browsers npm run test:e2e:install`).

## Skipped / conditional

| Spec | Reason |
|------|--------|
| `tests/smoke/public-signup.spec.ts` | Entire `describe.skip` — retired post-round-11; invitation + magic-link flows cover signup |
| `tests/smoke/stripe-webhook-endpoint.spec.ts` | Skipped unless `STRIPE_WEBHOOK_SECRET` is set and remote/local flag matches deployment |
| `tests/smoke/epic-5.4-documents-cron-sse.spec.ts` (US-31) | Skipped unless AWS + `S3_BUCKET_NAME` configured |
| `tests/smoke/epic-5.4-documents-cron-sse.spec.ts` (US-36) | Skipped unless `CRON_SECRET` (+ `E2E_CRON_REMOTE=1` against preview) |

## Implemented

| Spec | Test | BRD TC ID(s) | Status |
|---|---|---|---|
| `tests/smoke/admin-advisors.spec.ts` | admin can view advisors list with at least one row | TBD | Implemented |
| `tests/smoke/admin-intake-script.spec.ts` | list page shows intake questions with shared header, edit, and visibility controls | TBD | Implemented |
| `tests/smoke/admin-intake-script.spec.ts` | editing a question round-trips the text through the DB | TBD | Implemented |
| `tests/smoke/admin-intake-script.spec.ts` | toggling a question's visibility round-trips through the DB | TBD | Implemented |
| `tests/smoke/admin-intake-script.spec.ts` | visibility toggle updates the rendered counts without a hard reload | TBD | Implemented |
| `tests/smoke/advisor-billing-gate.spec.ts` | advisor without an active subscription is sent to /advisor/billing | TBD | Implemented |
| `tests/smoke/advisor-billing-gate.spec.ts` | /advisor, /advisor/pipeline, and /advisor/dashboard all redirect the no-sub advisor to billing | TBD | Implemented |
| `tests/smoke/advisor-clients.spec.ts` | advisor can view client list and open a client | TBD | Implemented |
| `tests/smoke/advisor-intake-review.spec.ts` | advisor can navigate from pipeline to /advisor/review/[id] and see transcripts | TBD | Implemented |
| `tests/smoke/advisor-intake-review.spec.ts` | advisor cannot view another advisor's intake review via direct URL | TBD | Implemented |
| `tests/smoke/advisor-logo-endpoint.spec.ts` | unauthenticated GET returns 401 | TBD | Implemented |
| `tests/smoke/advisor-logo-endpoint.spec.ts` | non-USER role (admin) is blocked with 403 | TBD | Implemented |
| `tests/smoke/advisor-logo-endpoint.spec.ts` | client receives the assigned advisor's logo as image bytes | TBD | Implemented |
| `tests/smoke/admin-api-authz.spec.ts` | unauthenticated GET on existence-leak admin endpoints returns 404 | TBD | Implemented |
| `tests/smoke/admin-api-authz.spec.ts` | non-admin advisor receives 404 from /api/admin/control-center | TBD | Implemented |
| `tests/smoke/admin-api-authz.spec.ts` | client receives 404 from /api/admin/audit-log/export | TBD | Implemented |
| `tests/smoke/admin-api-authz.spec.ts` | admin gets CSV from /api/admin/audit-log/export | TBD | Implemented |
| `tests/smoke/admin-api-authz.spec.ts` | admin gets JSON from /api/admin/control-center | TBD | Implemented |
| `tests/smoke/admin-api-authz.spec.ts` | admin gets ZIP from /api/admin/exports?scope=system | TBD | Implemented |
| `tests/smoke/admin-route-coverage.spec.ts` | admin can load every nav target without 5xx | TBD | Implemented |
| `tests/smoke/auth-flow-hardening.spec.ts` | magic-link verify is single-use (replay -> /failed?reason=used) | TBD | Implemented |
| `tests/smoke/auth-flow-hardening.spec.ts` | magic-link verify rejects a tampered token (/failed?reason=not_found) | TBD | Implemented |
| `tests/smoke/auth-flow-hardening.spec.ts` | magic-link issuance rate-limits per (ip, email) | TBD | Implemented |
| `tests/smoke/auth-flow-hardening.spec.ts` | stripe webhook rejects POST without Stripe-Signature header | TBD | Implemented |
| `tests/smoke/auth-flow-hardening.spec.ts` | stripe webhook rejects POST with a bogus Stripe-Signature header | TBD | Implemented |
| `tests/smoke/audit-log-access.spec.ts` | admin can view /admin/audit-log | TBD | Implemented |
| `tests/smoke/audit-log-access.spec.ts` | advisor gets 404 on /admin/audit-log | TBD | Implemented |
| `tests/smoke/audit-log-access.spec.ts` | client gets 404 on /admin/audit-log | TBD | Implemented |
| `tests/smoke/audit-log-access.spec.ts` | unauthenticated request to /admin/audit-log redirects or 404s | TBD | Implemented |
| `tests/smoke/audit-log-access.spec.ts` | non-admin gets 404 on /api/admin/audit-log/export | TBD | Implemented |
| `tests/smoke/audit-log-csv-export.spec.ts` | admin can download CSV; rows parse; export action self-audits | TBD | Implemented |
| `tests/smoke/audit-log-wiring.spec.ts` | admin create + soft-delete each leave a single audit row with the right shape | TBD | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | wrong password shows the credential error and stays on /signin | Epic 5.6 / US-49 | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | unauthenticated user hitting /dashboard is sent to magic-link sign-in with callbackUrl | Epic 5.6 / US-49 | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | client cannot reach /admin and lands on /dashboard?error=unauthorized | Epic 5.6 / US-49 | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | client cannot reach /advisor and lands on /dashboard?error=unauthorized | Epic 5.6 / US-49 | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | advisor cannot view admin content when navigating directly to /admin | Epic 5.6 / US-49 | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | advisor sees an unauthorized notice after attempting /admin | Epic 5.6 / US-49 | Implemented |
| `tests/smoke/auth-edge-cases.spec.ts` | client sees an unauthorized notice after attempting /admin | Epic 5.6 / US-49 | Implemented |
| `tests/smoke/auth.spec.ts` | advisor can sign in and load their dashboard | TBD | Implemented |
| `tests/smoke/auth.spec.ts` | client can sign in and load their dashboard | TBD | Implemented |
| `tests/smoke/auth.spec.ts` | admin can sign in and load their dashboard | TBD | Implemented |
| `tests/smoke/client-dashboard.spec.ts` | dashboard reflects submitted intake state | TBD | Implemented |
| `tests/smoke/client-intake.spec.ts` | can complete the wizard end-to-end via the Type tab | TBD | Implemented |
| `tests/smoke/client-intake.spec.ts` | Next is disabled and Save is disabled until a response is typed | TBD | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-1: send invitation normalizes email and shows Sent in history | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-9: filter invitations by status and client email search | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-8 / US-9: expire invitation hides resend; resend is not offered for Expired | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-8: advisor can resend a sent invitation | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | test invitation issue endpoint returns signup URL with invite param | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-1: intake-waived invitation links to assessment callback | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-6: password registration endpoint returns 410 Gone | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-6: invalid invite token shows a clear error | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-5: opened API advances SENT to OPENED | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-5 / US-6 / US-7: client redeems invite and lands on intake | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-6 / US-7: intake-waived invite lands on assessment | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | US-4: shareable link alert when initial send email fails | Epic 5.1 | Implemented |
| `tests/smoke/client-invitation-onboarding.spec.ts` | resend shows shareable link when email delivery fails | Epic 5.1 | Implemented |
| `tests/smoke/client-portal-branding.spec.ts` | branded client sees advisor branding signals on /dashboard | TBD | Implemented |
| `tests/smoke/default-branding-fallback.spec.ts` | client with brandingEnabled=false advisor sees the platform default | TBD | Implemented |
| `tests/smoke/advisor-branding-edit.spec.ts` | advisor saves tagline/colors; client portal + branding audit; negative validation | TBD | Implemented |
| `tests/smoke/epic-5.2-advisor-intake-approval.spec.ts` | advisor approves submitted intake and client unlocks assessment | US-11 | Implemented |
| `tests/smoke/epic-5.2-advisor-intake-approval.spec.ts` | advisor rejects submitted intake | US-11 | Implemented |
| `tests/smoke/epic-5.2-assessment-progress.spec.ts` | governance question shows four maturity levels and saves selection | US-13 / US-14 | Implemented |
| `tests/smoke/epic-5.2-assessment-progress.spec.ts` | client resumes at saved pillar question after sign-out and sign-in | US-13 / US-14 | Implemented |
| `tests/smoke/epic-5.2-assessment-progress.spec.ts` | server position wins over stale localStorage on hub reload | US-13 / US-14 | Implemented |
| `tests/smoke/epic-5.2-dashboard-heatmap.spec.ts` | client dashboard shows populated six-cell heat map after scoring | US-16 | Implemented |
| `tests/smoke/epic-5.2-dashboard-heatmap.spec.ts` | client dashboard shows empty heat map placeholder before scoring | US-16 | Implemented |
| `tests/smoke/epic-5.2-report-publish.spec.ts` | client cannot download PDF before advisor publishes | US-19–20 | Implemented |
| `tests/smoke/epic-5.2-report-publish.spec.ts` | advisor publishes draft and client downloads published PDF | US-19–20 | Implemented |
| `tests/smoke/epic-5.3-household-profiles.spec.ts` | US-21: client adds a household member | Epic 5.3 | Implemented |
| `tests/smoke/epic-5.3-household-profiles.spec.ts` | US-48: hidden members are omitted from advisor intake review | Epic 5.3 | Implemented |
| `tests/smoke/epic-5.3-household-profiles.spec.ts` | US-49: advisor disabling profiles hides client nav and /profiles | Epic 5.3 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | US-28: pipeline search filters to assigned client | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | US-28: pipeline stalled filter toggle is available | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | US-34: advisor cannot open another advisor's intelligence detail | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | US-35: notification preferences page loads | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | Workflows nav: Intake → intake review pipeline filter | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | Workflows nav: Document requests → documents-needed filter | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | Workflows nav: Engagements → engagements workspace | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-documents-cron-sse.spec.ts` | presigned upload-url → S3 PUT → confirm marks requirement fulfilled | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-documents-cron-sse.spec.ts` | rejects missing and invalid Authorization | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-documents-cron-sse.spec.ts` | accepts Bearer CRON_SECRET and returns processing JSON | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-documents-cron-sse.spec.ts` | status-stream sends connected and pipeline_update for advisor | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.4-documents-cron-sse.spec.ts` | pipeline UI shows Live updates after SSE connects | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | governance area lists pillar questions with edit and visibility controls | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | editing question text round-trips through the DB | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | visibility toggle round-trips through the DB | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | creating and deleting a question round-trips through the DB | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | reorder controls are enabled and submit without error | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | creating a question writes a pillar_question.create audit row | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | assessment bank index shows shared header and risk-area cards | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | legacy /admin/question-bank URLs redirect to canonical assessment paths | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | control center exposes configuration question bank cards | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | platform ADMIN can use question banks but not super-admin-only surfaces | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | catalog page renders services and rules tabs | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | creating a catalog service round-trips through the list | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | rules tab and new rule form render | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | super admin can open risk thresholds form | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | super admin can save and restore threshold values | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | non-admin users cannot reach super-admin threshold settings | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | super admin can open risk signals dashboard | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | platform admin cannot open super-admin risk signals | Epic 5.5 | Implemented |
| `tests/smoke/risk-signals-data.spec.ts` | admin tenant exposure rows match fixture counts per advisor | Epic 5.5 | Implemented |
| `tests/smoke/risk-signals-data.spec.ts` | advisor A signal feed shows only A fixture signals (90-day window) | Epic 5.4 | Implemented |
| `tests/smoke/risk-signals-data.spec.ts` | advisor B signal feed shows only B fixture signals (90-day window) | Epic 5.4 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | super admin settings shows advisor feature flag controls | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | toggling a feature flag round-trips through the DB | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | analytics dashboard loads aggregate view | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | admin sidebar exposes Operations Health link | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | operations health page loads for admin | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | client accounts list renders seeded client | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | advisor edit page exposes portal access controls | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | governance leads page renders assignment table | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | intake management and assessment admin views load | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.5-platform-admin.spec.ts` | legacy staff route redirects to admin user management | Epic 5.5 | Implemented |
| `tests/smoke/epic-5.6-mfa-sign-in.spec.ts` | credentials sign-in stops at MFA verify until TOTP is entered | Epic 5.6 / US-48 | Implemented |
| `tests/smoke/epic-5.6-mfa-sign-in.spec.ts` | recovery code completes sign-in and cannot be reused | Epic 5.6 / US-48 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | advisor can open the policy page and save a toggle | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | pending consent redirects to /consent/pending and Continue reaches dashboard | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | omitted fields default to No when Continue is clicked | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | signed-in client navigating to /dashboard is redirected to consent | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | settings revisit saves updated privacy preferences | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | advisor-disabled field is omitted from the consent prompt | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | pipeline shows client email instead of legal name when User.name consent is No | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | filling optional legal name grants advisor visibility | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | field fill writes client_pii.field_consent audit row | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-pii-consent.spec.ts` | advisor policy toggle writes pii_policy.field_disable audit row | Epic 5.6 / US-50–51 | Implemented |
| `tests/smoke/epic-5.6-rbac.spec.ts` | active session is ended after soft-delete and sign-in is blocked | Epic 5.6 / US-49 | Implemented |
| `tests/smoke/epic-5.7-platform-host.spec.ts` | main app sign-in is served on the default Playwright base URL | Epic 5.7 / US-61 | Implemented |
| `tests/smoke/epic-5.8-advisor-policy-templates.spec.ts` | assigned advisor downloads Word and PDF from pipeline UI and API | Epic 5.8 / US-62–63 | Implemented |
| `tests/smoke/epic-5.8-advisor-policy-templates.spec.ts` | unassigned advisor receives 404 for client assessment templates | Epic 5.8 / US-62–63 | Implemented |
| `tests/smoke/intake-audio-endpoint.spec.ts` | owner receives the audio bytes (200) | TBD | Implemented |
| `tests/smoke/intake-audio-endpoint.spec.ts` | assigned advisor receives the audio bytes (200) | TBD | Implemented |
| `tests/smoke/intake-audio-endpoint.spec.ts` | unassigned advisor gets 404 (regression: no cross-tenant audio access) | TBD | Implemented |
| `tests/smoke/intake-audio-endpoint.spec.ts` | unauthenticated request gets 401 | TBD | Implemented |
| `tests/smoke/landing-hero-audience.spec.ts` | families tab is default and exposes family CTAs | Marketing | Implemented |
| `tests/smoke/landing-hero-audience.spec.ts` | advisors tab shows advisor workspace copy and CTAs | Marketing | Implemented |
| `tests/smoke/landing-hero-audience.spec.ts` | ?audience=advisors deep-links the advisor tab | Marketing | Implemented |
| `tests/smoke/landing-hero-audience.spec.ts` | #advisors hash deep-links the advisor tab | Marketing | Implemented |
| `tests/smoke/landing-hero-audience.spec.ts` | request demo pre-fills the contact form | Marketing | Implemented |
| `tests/smoke/landing-hero-audience.spec.ts` | remembers last audience in session storage | Marketing | Implemented |
| `tests/smoke/magic-link-test-helper.spec.ts` | POST /api/test/magic-link/issue returns rawToken + verifyUrl | Infra | Implemented |
| `tests/smoke/magic-link-test-helper.spec.ts` | issue → verify URL → dashboard signs the client in | Infra | Implemented |
| `tests/smoke/magic-link-test-helper.spec.ts` | malformed email returns 400, not 500 | Infra | Implemented |
| `tests/smoke/signin-after-phase-b.spec.ts` | magic-link issue → verify → dashboard, session.user.email is the original plaintext | Infra | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | approved client sees all six pillar cards | US-12 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | client can open governance pillar and reach the questionnaire | US-12 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | client can open governance and cyber pillars from the hub | US-12 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | client without approved intake cannot open /assessment | US-12 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | waived invitation redemption shows six pillar cards | US-12 | Implemented |
| `tests/smoke/stripe-webhook-endpoint.spec.ts` | same event.id delivered twice → second call is deduped (no double-processing) | TBD | Implemented |
| `tests/smoke/stripe-webhook-endpoint.spec.ts` | two parallel deliveries of same event.id → exactly one is processed (atomic claim) | TBD | Implemented |
| `tests/smoke/stripe-webhook-endpoint.spec.ts` | bad signature → 400 and no StripeWebhookEvent row created | TBD | Implemented |
| `tests/smoke/subdomain-routing.spec.ts` | active subdomain serves the branded client portal | TBD | Implemented |
| `tests/smoke/subdomain-routing.spec.ts` | advisor sign-in on tenant host reaches /advisor workspace | TBD | Implemented |
| `tests/smoke/subdomain-routing.spec.ts` | Not Available page renders when subdomain is active but not dnsVerified | TBD | Implemented |
| `tests/smoke/subdomain-routing.spec.ts` | Not Available page renders when subdomain is dnsVerified but not active | TBD | Implemented |
| `tests/smoke/invited-tenant-branding.spec.ts` | tenant invite URL uses advisor subdomain (KAN-1 / KAN-113) | KAN-1 | Implemented |
| `tests/smoke/invited-tenant-branding.spec.ts` | signup on tenant host shows advisor branding then intake | KAN-1 | Implemented |
| `tests/smoke/invited-tenant-branding.spec.ts` | intake-waived tenant invite shows branding on assessment | KAN-1 | Implemented |
| `tests/smoke/tenant-isolation.spec.ts` | advisor cannot open another advisor's client via direct URL | TBD | Implemented |
| `tests/smoke/us-46b-answer-admin-notes.spec.ts` | platform admin can add and remove an intake answer note | US-46b | Implemented |
| `tests/smoke/us-46b-answer-admin-notes.spec.ts` | advisor cannot access admin intake review or see admin notes | US-46b | Implemented |

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
- ~~Deactivated account shows `notice=account_deactivated`~~ *(covered by `epic-5.6-rbac.spec.ts`)*
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
- ~~Workflows sidebar: Intake, Document requests, Engagements deep links~~ *(covered by `epic-5.4-advisor-workspace.spec.ts`)*
- ~~Full client document upload E2E (S3)~~ *(covered by `epic-5.4-documents-cron-sse.spec.ts`; needs AWS + S3_BUCKET_NAME)*
- ~~Cron reminder jobs (CRON_SECRET + GET smoke)~~ *(covered by `epic-5.4-documents-cron-sse.spec.ts`)*
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
- ~~Admin can list clients (`/admin/clients`)~~ *(covered by `epic-5.5-platform-admin.spec.ts`)*
- ~~Admin can assign lead to advisor (`/admin/leads`)~~ *(covered by `epic-5.5-platform-admin.spec.ts` — list view)*
- ~~Admin intake management view (`/admin/intake`)~~ *(covered by `epic-5.5-platform-admin.spec.ts`)*
- ~~Admin assessment management view (`/admin/assessment`)~~ *(covered by `epic-5.5-platform-admin.spec.ts`)*
- ~~Admin question bank: hide/show question~~ *(covered by `epic-5.5-platform-admin.spec.ts`)*
- ~~Admin question bank: edit copy~~ *(covered by `epic-5.5-platform-admin.spec.ts`)*
- ~~Admin settings page renders~~ *(covered by `epic-5.5-platform-admin.spec.ts`)*
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
- ~~Advisor branding edit flow (tagline/colors at `/advisor/settings`, reflected in client portal)~~ *(covered by `advisor-branding-edit.spec.ts`; `firmName`/`brandName` are admin-managed read-only on that page)*
- ~~Advisor branding audit log entries created on update (`AdvisorBrandingAuditLog`)~~ *(covered by `advisor-branding-edit.spec.ts`)*
- ~~`subscriptionQualifiesForPortalEnablement` gate: no-sub advisor redirected to `/advisor/billing`~~ *(covered by `advisor-billing-gate.spec.ts`)*
- ~~Subscription edge states (grace expiry, 30-day paid signup, qualifying Stripe)~~ *(covered by `advisor-portal-subscription.test.ts`)*
- ~~Subdomain change rate limit (3 / 24h)~~ *(covered by `rate-limit.test.ts`)*

Subdomain routing (see `docs/white-label-subdomains.md`). Seeded **slugs**; Playwright builds hosts with `TENANT_SUBDOMAIN_SUFFIX` (default `-staging` when `PLAYWRIGHT_BASE_URL` is `preview.akilirisk.com`):
- `independent-wealth` (+ suffix) -> advisor2, active+verified -> branded portal. *(covered by `subdomain-routing.spec.ts`, invite journey by `invited-tenant-branding.spec.ts` / KAN-113)*
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
- **`/api/admin/reports/export` + `/api/admin/advisors/[userId]/logo`
  returned 500 instead of 404 on unauthorized callers**. Both routes
  wrapped `requireAdminRole()` in the same try-block as the rest of the
  handler, so the auth throw was caught by the generic 500 handler.
  Switched both to call `getAuditAdminActorOrNull()` outside the try and
  early-return 404 when the actor is missing — matches the existence-leak
  posture already used by `/api/admin/exports`,
  `/api/admin/audit-log/export`, and `/api/admin/control-center`.
  Regression: `admin-api-authz.spec.ts` — 3 fixme()s flipped live
  (unauth + non-admin reports export, unauth advisors-logo).
- **`/api/advisor/branding` returned 500 with a `Not authenticated`
  body to unauthenticated/non-advisor callers**. The body had the right
  shape but the wrong status. Added an `isAuthError` check inside both
  GET and PUT catch blocks that maps `requireAdvisorRole()`'s thrown
  messages (`"Not authenticated"`, `"Unauthorized: ..."`) to 401 instead
  of 500. Regression: `admin-api-authz.spec.ts` — 1 fixme flipped live
  (client GET returns 401).
- **`/admin/scoring` 404'd ("This page did not pass due diligence.")
  because the directory had no parent `page.tsx`** — only the
  `thresholds/` child existed. Added a 4-line redirect-only `page.tsx`
  modeled on the existing `/admin/question-bank` legacy redirect.
  Regression: `admin-route-coverage.spec.ts` `/admin/scoring redirects
  to /admin/scoring/thresholds` (fixme flipped live).
- **`/api/address/suggestions` was public + unrate-limited**. Anyone
  could use AkiliRisk as a free OSM Nominatim proxy; sustained abuse
  would get our User-Agent banned. Added an `auth()` check (return 401
  if no session) and a per-IP `rateLimit({ key: "address-suggestions:
  <ip>", limit: 20, windowMs: 60_000 })`. The sole UI consumer
  (`<AddressSearch />` in `src/components/settings/`) is post-auth, so
  no flow breaks. Regression: `admin-route-coverage.spec.ts` —
  fixme replaced with two live tests (401 unauth + at-least-one-429
  under sustained authenticated load).
- **Sweep — seven more advisor API routes returning 500-on-unauth**
  (95295db). Same root cause as cbb4668: `requireAdvisorRole()` thrown
  inside a try-block whose catch returned a generic 500 for every error
  including auth. Promoted the inline `isAuthError` helper from
  `/api/advisor/branding` to a shared `isAdvisorAuthError(e)` export in
  `src/lib/advisor/auth.ts`; routes patched: DELETE
  `/api/advisor/branding/logo`, POST `/api/advisor/branding/logo/direct`,
  POST `/api/advisor/branding/logo/confirm`, POST
  `/api/advisor/branding/logo/upload-url`, GET
  `/api/advisor/branding/logo/view`, POST `/api/advisor/subdomain/check`,
  POST + DELETE `/api/advisor/subdomain/claim`. Regression:
  `advisor-api-authz-sweep.spec.ts` — 8 unauth probes, one per
  (verb, path).

## Process

1. When implementing a new test, move its row from "Not Implemented" to "Implemented"
2. Fill in the BRD TC ID(s) it covers
3. If a test is added that has no BRD TC, leave the column blank but keep the row
4. If a feature is removed, delete the row outright (don't mark removed)
5. If functionality is changed or added, ensure it aligns with BRD
