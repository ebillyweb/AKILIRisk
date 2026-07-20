# Scheduled smoke tests

A small, curated set of Playwright tests runs on a schedule against the live
**preview** environment (`https://preview.akilirisk.com`) to catch outages and
auth regressions between deploys.

- **Workflow:** [`.github/workflows/smoke-tests.yml`](../.github/workflows/smoke-tests.yml)
- **Schedule:** every 6 hours (UTC), plus manual runs via **Actions → Smoke
  Tests (preview) → Run workflow**.
- **Selection:** `playwright test --grep @smoke` — only tests tagged `@smoke`.
- **Test code comes from `staging`** (see below).
- **Current scope:** advisor + admin login, sign-out header refresh, plus negative auth cases.

## How it works (branch model)

Preview deploys from the **`staging`** branch, so the tests must match the code
running there. But `schedule:` triggers only fire from the **default branch**.
So the workflow file lives on the default branch and its checkout step pulls
**`staging`**, then runs `playwright test --grep @smoke` against preview.

Consequence: the `@smoke` **tags live on `staging`**, not on the default branch.
Add or change tagged tests on `staging`. Override the tested ref with the
`test_ref` dispatch input if preview ever deploys from a different branch.

### Covered cases

Positive (`tests/smoke/auth.spec.ts`):

- Advisor signs in with a password and lands on `/advisor`.
- Admin signs in with a password and lands on `/admin`.

Sign-out (`tests/smoke/sign-out-header.spec.ts`):

- Signed-in advisor visiting `/` sees authenticated marketing header CTAs; after
  sign-out the header shows the public Sign In / Start Assessment pair (catches
  stale `useSession()` / soft-refresh regressions).
- Advisor workspace slim header sign-out clears the session and redirects to
  sign-in.

Negative (`tests/smoke/auth-edge-cases.spec.ts`):

- Wrong password shows the credential error and stays on `/signin`.
- An unauthenticated visit to `/dashboard` is redirected to the client
  sign-in (`/signin?role=client`) with the `callbackUrl` preserved.
- An advisor navigating directly to `/admin` is bounced with
  `error=unauthorized` and sees the "Access denied" notice.

Intake TTS (`tests/smoke/intake-tts-endpoint.spec.ts`):

- Advisor-authenticated `POST /api/intake/tts` returns `audio/mpeg` bytes.
  Fails when preview's OpenAI quota is exhausted (operator hint in the
  assertion message) so replenishment issues surface via the scheduled run.
  Skips only when `OPENAI_API_KEY` is missing on the deployment.

Support ticket (`tests/smoke/support-ticket.spec.ts`):

- Advisor opens `/support`, fills the ticket form, and attaches a tiny PNG
  screenshot. Does **not** submit (avoids real Resend sends from the canary).
  Email payload + attachment construction is covered by the mocked unit test
  `src/lib/email/support-ticket.send.test.ts`.

AI recommendation narratives (`tests/smoke/ai-recommendation-narratives.spec.ts`):

- Advisor-authenticated `POST /api/ai-narratives/smoke-probe` runs one OpenAI
  structured-output call against a fixed synthetic input (no assessment DB
  reads, no writes) and asserts catalog-constrained recommendation shape.
  Fails when preview's OpenAI quota is exhausted (operator hint in the
  assertion message). Skips only when `OPENAI_API_KEY` is missing.
  Does **not** require `LLM_NARRATIVES_ENABLED` — the probe exercises the
  generator directly so the canary stays useful while the flag is off.

White-label PDF branding (`tests/smoke/white-label-pdf-branding.spec.ts`):

- Advisor-authenticated `POST /api/pdf/white-label-smoke-probe` renders a
  synthetic AssessmentReport PDF with fixed firm branding (no assessment DB
  reads, no writes). Asserts `application/pdf`, `%PDF` magic, Content-
  Disposition slug, response headers, and that the firm name is embedded in
  the PDF bytes (cover / confidentiality path). Catches regressions that
  drop white-label copy or fall back to platform defaults.

Operations health (`tests/smoke/operations-health.spec.ts`):

- Admin opens `/admin/operations` and asserts core services (app, database,
  auth) are healthy, and Stripe / OpenAI / Resend / S3 are configured and
  not `down`. Catches credential and provider outages between deploys.
  Redis and white-label DNS are intentionally soft (env-specific).

Tenant portal (`tests/smoke/subdomain-routing.spec.ts`):

- Active fixture tenant (`independent-wealth`) serves the branded client
  portal on the preview path host (`/t/{slug}` or subdomain).
- Unverified tenant (`inactive-tenant`) returns the Subdomain Not Available
  404 shell. Catches proxy / tenant-routing regressions.
- If the active tenant drifts off preview DB, restore with
  `node scripts/restore-independent-wealth-fixture.js` (same `DATABASE_URL` /
  `ENCRYPTION_KEY` as Preview), then wait briefly for warm-instance subdomain
  cache misses to expire before re-running.

The client-role negative cases (client blocked from `/admin` and `/advisor`)
are left untagged because they sign in as a client, which needs
`ENABLE_TEST_AUTH=1` on preview — see [Extending scope](#extending-scope-later).

The job runs Playwright against the *live* deployment; it does not build or
start the app (`playwright.config.ts` has no `webServer`). It defaults to
`https://preview.akilirisk.com` and can be pointed elsewhere via the
`base_url` dispatch input or the `PLAYWRIGHT_BASE_URL` env var.

## Adding a test to the scheduled suite

On the **`staging`** branch (the one deployed to preview), tag the test `@smoke`:

```ts
test("something critical still works", { tag: "@smoke" }, async ({ page }) => {
  // ...
});
```

Keep the scheduled set small and reliable — it is a canary, not full coverage.
The complete suite still runs via `npm run test:e2e`.

## Credentials

The advisor and admin cases use password login. `tests/fixtures/users.ts` reads
credentials from env vars and falls back to the seeded preview test users when
they are unset. To override the fallbacks, set these **repository secrets**
(Settings → Secrets and variables → Actions):

| Secret | Overrides |
| --- | --- |
| `SMOKE_ADVISOR_EMAIL` | advisor login email |
| `SMOKE_ADVISOR_PASSWORD` | advisor login password |
| `SMOKE_ADMIN_EMAIL` | admin login email |
| `SMOKE_ADMIN_PASSWORD` | admin login password |

If a secret is unset the workflow passes an empty value and the fixture uses its
seeded fallback, so the run works out of the box as long as the seeded users
exist on preview with the default passwords.

## Failure reporting

- The **`playwright-report`** artifact (traces, screenshots, video) is uploaded
  on every run and retained for 14 days.
- On a scheduled **failure**, the workflow opens a GitHub issue labelled
  `smoke-failure` (or comments on the existing open one).
- On the next scheduled **pass**, that issue is auto-closed.

## Extending scope later

### Client login (magic link)

The client case in `auth.spec.ts` is intentionally **not** tagged `@smoke`. It
signs in through the test-only magic-link endpoint
(`/api/test/magic-link/issue`), which requires **`ENABLE_TEST_AUTH=1`** on the
target deployment (see `.env.example`). To add client login to the scheduled
suite:

1. Set `ENABLE_TEST_AUTH=1` on the Vercel **Preview** environment and redeploy
   (never enable in production).
2. On `staging`, change the client entry's `smoke` flag to `true` in
   `tests/smoke/auth.spec.ts`.
