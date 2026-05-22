This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

---

## Testing & Test Credentials

Use these only in local/development. Ensure the app and database are running, then run the seed scripts as needed.

### Seed scripts (run in order if starting fresh)

| Script | Purpose |
|--------|--------|
| `node scripts/seed-advisor-test-data.js` | Creates the full test-fixture set: five advisors (`advisor`, `advisor2`, `advisor3`, `advisor4`, `advisor-unbranded`) with profiles, subscriptions, and white-label subdomain **slugs** where applicable; four clients (`client`, `client-mfa`, `client-fresh`, `client-unbranded`) with profiles, assignments, and (for `client`/`client-mfa`) submitted intake interviews with sample responses. Idempotent. |
| `node scripts/seed-platform-reserved-subdomains.js` | Upserts platform-reserved slug labels (`preview`, `www`, `app`, …) into `ReservedSubdomains`. Optional; code also blocks these at claim time. |
| `node scripts/seed-invite-code.js` | Creates invite codes: **123456** (no prefill) and **BELV01** (prefills `buddy+belvcustomer@ebilly.com` on signup). Run with args: `node scripts/seed-invite-code.js [CODE] [PREFILL_EMAIL]`. |
| `node scripts/set-advisor-role.js` | Sets `advisor@test.com` role to ADVISOR (run if the advisor menu is missing). |
| `node scripts/set-admin-role.js` | Creates or updates `buddy@ebilly.com` as ADMIN (designated admin account). |

### Test users & credentials

| Role | Email | Password | Notes |
|------|--------|----------|--------|
| **Advisor** | `advisor@test.com` | `testpassword123` | Has advisor profile and assigned client. After login, use Advisor Hub / Portfolio. |
| **Advisor (no clients)** | `advisor2@test.com` | `testpassword123` | Slug `independent-wealth` (active+verified). On staging Preview: `https://independent-wealth-staging.akilirisk.com`. Production: `https://independent-wealth.akilirisk.com`. |
| **Advisor (unverified subdomain, no sub)** | `advisor3@test.com` | `testpassword123` | Slug `inactive-tenant` (`isActive=true`, `dnsVerified=false`). Staging tenant host: `inactive-tenant-staging.akilirisk.com`. Billing-gate fixture (no Subscription). |
| **Advisor (deactivated subdomain)** | `advisor4@test.com` | `testpassword123` | Slug `disabled-tenant` (`isActive=false`, `dnsVerified=true`). Staging: `disabled-tenant-staging.akilirisk.com` → "Subdomain Not Available". |
| **Advisor (no branding)** | `advisor-unbranded@test.com` | `testpassword123` | `brandingEnabled=false` on profile. Used by the default-branding-fallback test. |
| **Client (no branding)** | `client-unbranded@test.com` | `testpassword123` | Assigned to `advisor-unbranded`; dashboard renders the default Akili lockup instead of advisor white-label. |
| **Client** | `client@test.com` | `testpassword123` | Seeded with a submitted intake; use for advisor review flow. |
| **Client (MFA)** | `client-mfa@test.com` | `testpassword123` | Second client for MFA testing. Sign in, go to Settings, enable MFA, then sign out and sign in again to hit the MFA verify screen. |
| **Client (fresh intake)** | `client-fresh@test.com` | `testpassword123` | No `IntakeInterview` row - used by Playwright intake happy-path tests. Reset between runs with `node scripts/reset-fresh-client-intake.js` (the test suite calls this in `beforeEach`). |
| **Admin** | `buddy@ebilly.com` | `Test1111!` | Admin access is restricted to this account in code. Run `set-admin-role.js` first. |

### Invitation emails (advisor → client)

Advisor “Send invitation” uses [Resend](https://resend.com) to email the signup link. To actually send emails:

1. Sign up at [resend.com](https://resend.com) and get an API key.
2. In `.env.local` add:
   - `RESEND_API_KEY=re_...` (your key)
   - `FROM_EMAIL=onboarding@resend.dev` (or your verified domain sender)

Without `RESEND_API_KEY`, the invitation is still created and the advisor sees a copyable link to share manually. The UI will show “Invitation created — email was not sent” and the link to copy.

### Invite codes (assessment signup flow)

- **123456** – Generic 6-character code (no email prefill).
- **BELV01** – Prefills signup email with `buddy+belvcustomer@ebilly.com`.

To create a custom code with optional prefill:

```bash
node scripts/seed-invite-code.js ABC123 buddy+belvcustomer@ebilly.com
```

### Testing the main flows

1. **Client assessment flow**  
   Home → **Start Assessment** → `/start` → enter **BELV01** (or **123456**) → signup (email prefilled if using BELV01) → redirect to intake → complete intake → advisor review → assessment unlocks.

2. **Advisor**  
   Sign in with `advisor@test.com` / `testpassword123` → you are redirected to Advisor Hub; use Portfolio, Client View, and review links as needed.

3. **Admin**  
   Run `node scripts/set-admin-role.js`, then sign in with `buddy@ebilly.com` / `Test1111!` → Admin nav (Advisors, Clients, Intake Management, Assessment Management, Settings).

4. **Request a review (no account)**
   Home → **Request a review here** → `/request-review` → submit the short form → creates a lead and notifies advisors.

5. **MFA verify flow**
   Sign in as `client-mfa@test.com` / `testpassword123` → **Settings** → **Enable Two-Factor Authentication** (complete setup). Sign out, then sign in again; you should be sent to the MFA verify screen (TOTP or recovery code) before reaching the dashboard.

After changing roles or re-seeding, sign out and sign in again (and hard refresh if needed) so the session and nav reflect the updates.

## White-label subdomains (advisor portals)

Advisors claim a slug under your apex (`PRODUCTION_DOMAIN`, e.g. `akilirisk.com`). **Staging Preview** uses `TENANT_SUBDOMAIN_SUFFIX=-staging` so tenants are `{slug}-staging.akilirisk.com`; **production** uses `{slug}.akilirisk.com`. The platform app stays on `preview.akilirisk.com` (staging) or `www.akilirisk.com` (production).

Full setup (Vercel domains, env vars, tests): **[docs/white-label-subdomains.md](docs/white-label-subdomains.md)**.

## End-to-end tests (Playwright)

Smoke tests live in `tests/`. They run against `https://preview.akilirisk.com` by default. Subdomain routing tests use `-staging` tenant hostnames automatically when the base URL is preview (see `playwright.config.ts`).

```bash
npm run test:e2e            # run headless
npm run test:e2e:headed     # show the browser
npm run test:e2e:ui         # interactive UI mode
npm run test:e2e:report     # open the last HTML report
npm run test:e2e -- tests/smoke/subdomain-routing.spec.ts
```

Override the target with `PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e`.
Credentials default to the Test Users table above; override per-role with `ADVISOR_EMAIL`,
`ADVISOR_PASSWORD`, `CLIENT_EMAIL`, `CLIENT_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
Coverage tracker: `tests/INVENTORY.md`.

The intake spec uses a dedicated seeded user (`client-fresh@test.com`) and resets
its intake state in `beforeEach` via `scripts/reset-fresh-client-intake.js`. The
reset reads `DATABASE_URL` from the same env files the seed scripts use, so if
your local `.env.local` points at the staging Neon DB, the reset hits
staging too. Run `node scripts/seed-advisor-test-data.js` once to provision the
user (it's idempotent).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
