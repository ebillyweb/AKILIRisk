# Local development troubleshooting

Common issues when running AkiliRisk against the shared Preview Neon database from your machine. For test credentials and seed scripts, see [CLAUDE.md](../CLAUDE.md#test-credentials) and [README.md](../README.md#testing--test-credentials).

---

## Shared Preview database + encryption key

Most local setups point `DATABASE_URL` at the same Neon database Vercel Preview uses. User emails and other PII are encrypted at rest with **`ENCRYPTION_KEY`**. That key must match the one on Preview **exactly** — a copy in `.env.preview` or an old generated value is not enough if Vercel was updated separately.

### Symptom: `Unsupported state or unable to authenticate data`

Runtime error from Node `crypto` during AES-256-GCM decrypt. Typical stack:

```
Error: Unsupported state or unable to authenticate data
    at decrypt (src/lib/encryption.ts)
    at decryptDeterministic (src/lib/encryption.ts)
    at decryptUserEmail (src/lib/auth/user-email-crypto.ts)
```

**What it means:** Sign-in may still work (lookup uses deterministic ciphertext, not decrypt), but any page that **decrypts** stored emails or PII will crash — e.g. `/admin/leads`, exports, advisor client lists.

**Root cause:** Local `ENCRYPTION_KEY` ≠ the key used when rows were written to Neon.

### Fix: sync `ENCRYPTION_KEY` from Vercel Preview

**Do not copy `ENCRYPTION_KEY` from `.env.preview` in the repo** — that file is often stale and does not match Vercel. Always pull from Vercel Preview or the dashboard.

```bash
# Pull Preview env (requires Vercel CLI linked to the project)
npx vercel env pull .env.vercel-sync --environment=preview

# Copy ENCRYPTION_KEY into .env.local, or merge manually from the Vercel dashboard:
# Project → Settings → Environment Variables → Preview → ENCRYPTION_KEY
```

After updating the key:

```bash
# Re-create admin + test fixtures with the correct key
node scripts/set-admin-role.js
node scripts/seed-advisor-test-data.js   # idempotent; subdomain conflicts are usually harmless

# Restart dev server so the process picks up the new env
rm -rf .next && npm run dev
```

**Important:** If you previously ran seed/admin scripts with a *wrong* key, you can end up with **duplicate users** for the same email (one row per key). Symptoms: some admin pages still fail decrypt for a subset of advisor profiles. Re-run the seed scripts after syncing the key; if problems persist, remove duplicate `User` / `AdvisorProfile` rows that were created under the wrong key (keep the rows that own real assignments and data).

### Variables that must stay in sync with Preview

| Variable | Why |
|----------|-----|
| `DATABASE_URL` | Same Neon DB as Preview |
| `ENCRYPTION_KEY` | Decrypt emails, MFA secrets, assessment answers, PII |

Optional but recommended to align for email links and auth callbacks when testing against Preview-shaped data:

| Variable | Local value |
|----------|-------------|
| `AUTH_URL` | `http://localhost:3000` |
| `NEXT_PUBLIC_URL` | `http://localhost:3000` |
| `NEXTAUTH_URL` | `http://localhost:3000` |

If you `vercel env pull` directly into `.env.local`, reset the three URL variables above — Preview pulls use `https://preview.akilirisk.com`.

---

## Authentication

### `MissingCSRF` on sign-in

Auth.js rejected the credentials callback because the CSRF cookie/token was missing or stale.

**Try:**

1. Hard refresh or clear cookies for `localhost:3000`
2. Close extra tabs on `/signin`
3. Restart dev server after changing `AUTH_SECRET` or `.env.local`
4. Clear Next cache: `rm -rf .next node_modules/.cache && npm run dev`

### `Credentials authorize failed: user not found`

The email/password path could not find a `User` row for the normalized email ciphertext.

**Try:**

```bash
node scripts/set-admin-role.js          # buddy@ebilly.com → SUPER_ADMIN, Test1111!
node scripts/seed-advisor-test-data.js  # advisor@test.com / Testpass1, clients, etc.
```

Confirm `ENCRYPTION_KEY` matches Preview (see above). Lookup is deterministic: the key used at sign-in must be the same key used when the user row was created.

### Sign-in works but admin/advisor pages crash on decrypt

See [Shared Preview database + encryption key](#shared-preview-database--encryption-key) above.

---

## Environment setup checklist

1. Copy `.env.example` → `.env.local`
2. Set `DATABASE_URL` to Neon (pooler URL is fine for the app)
3. Set `ENCRYPTION_KEY` from **Vercel Preview** (not a locally generated value when using the shared DB)
4. Set `AUTH_SECRET` (generate: `openssl rand -base64 32`)
5. Set local URLs: `AUTH_URL`, `NEXT_PUBLIC_URL`, `NEXTAUTH_URL` → `http://localhost:3000`
6. Run seed scripts (see [CLAUDE.md](../CLAUDE.md#test-credentials))
7. `npm run dev`

Generate a **new** `ENCRYPTION_KEY` only when using an isolated local database. Never rotate it on a shared DB without a planned re-encryption migration.

---

## Seed scripts (quick reference)

| Script | Purpose |
|--------|---------|
| `node scripts/set-admin-role.js` | `buddy@ebilly.com` → SUPER_ADMIN, password `Test1111!` |
| `node scripts/seed-advisor-test-data.js` | Full advisor/client test fixtures (`Testpass1`) |
| `node scripts/seed-invite-code.js` | Invite codes `123456`, `BELV01` |
| `node scripts/set-advisor-role.js` | Ensure `advisor@test.com` has ADVISOR role |
| `node scripts/reset-fresh-client-intake.js` | Reset `client-fresh@test.com` intake for Playwright |

All scripts that touch users require `ENCRYPTION_KEY` in `.env.local`.

---

## Clear Next.js cache (safe)

```bash
rm -rf .next node_modules/.cache && npm run dev
```

Do **not** run `rm -rf /` or delete paths outside the project root.

---

## Advisor signup: `Invalid value for argument tier`. Expected SubscriptionTier

**Symptom:** `POST /api/auth/advisor-signup` returns 500; Prisma error on `subscription.create` with tier `ESSENTIALS`, `BUSINESS`, or `PLATINUM`.

**Cause:** The Neon database enum still has legacy values (`STARTER`, `GROWTH`, …) while the app expects the modular tier rename (`ESSENTIALS`, `PROFESSIONAL`, `BUSINESS`, `PLATINUM`, `ENTERPRISE`).

**Fix:**

```bash
npx prisma migrate deploy
npx prisma generate   # if the dev server was already running
# restart dev server
```

Check status: `npx prisma migrate status` — migration `20260625120000_subscription_tier_modular_rename` must be applied.

---

## Advisor email verification link fails (`verify-failed?reason=not_found`)

**One-time links:** Verification tokens are consumed on first successful click. Reusing the same link returns `not_found` or `used` — use **Resend verification email** on the check-email page instead.

**Broken query string (`&amp;` in URL):** If you copy the plain-text fallback from the email, some clients include literal `&amp;` instead of `&`. Click the **Confirm email** button instead, or sign in at `/signin?portal=advisor` if you already verified once.

---

## Related docs

| Topic | Doc |
|-------|-----|
| MFA / TOTP debugging | [DEBUG_TOTP_QUICK_START.md](./DEBUG_TOTP_QUICK_START.md), [MFA_DEBUGGING_SUMMARY.md](./MFA_DEBUGGING_SUMMARY.md) |
| White-label subdomains (local vs Preview) | [white-label-subdomains.md](./white-label-subdomains.md) |
| Database migrations & pillar seed | [CLAUDE.md](../CLAUDE.md#database-operations) |
| Roles & access | [ROLES.md](./ROLES.md), [ACCESS-LEVELS-BY-ROLE.md](./ACCESS-LEVELS-BY-ROLE.md) |
