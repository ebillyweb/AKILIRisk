# White-label advisor subdomains

Advisors claim a **canonical slug** stored in `AdvisorSubdomain.subdomain` (e.g. `ebilly`). Public URLs are built from `PRODUCTION_DOMAIN` and an optional environment suffix.

## Host types

| Type | Example (staging) | Example (production) | Routing |
|------|-------------------|----------------------|---------|
| **Platform** | `preview.akilirisk.com` | `www.akilirisk.com` | Main app (advisor hub, admin, sign-in). Never tenant-branded. |
| **Tenant** | `ebilly-staging.akilirisk.com` | `ebilly.akilirisk.com` | Branded client portal when `isActive && dnsVerified`. |

Platform labels (`preview`, `www`, `app`, `api`, `admin`, …) cannot be claimed. See `PLATFORM_SUBDOMAIN_LABELS` in `src/lib/advisor/platform-subdomain.ts`.

## Environment variables

| Variable | Preview / staging | Production |
|----------|-------------------|------------|
| `PRODUCTION_DOMAIN` | `akilirisk.com` (required) | Same |
| `TENANT_SUBDOMAIN_SUFFIX` | `-staging` (→ `{slug}-staging.akilirisk.com`) | **Unset** |
| `SUBDOMAIN_AUTO_ACTIVATE` | `true` (recommended on Preview) | Default on (omit or `true`) |
| `AUTH_URL` / `NEXT_PUBLIC_URL` | `https://preview.akilirisk.com` | `https://www.akilirisk.com` (or canonical) |

Copy `.env.preview` for local Preview parity. Reference: `.env.example`.

## Claim flow

1. Advisor opens **Settings → Custom Domain** on the platform host (`preview` or `www`).
2. Enters a slug (3–20 chars, lowercase). Do **not** include `-staging`; it is appended automatically when `TENANT_SUBDOMAIN_SUFFIX` is set.
3. Claim API (`/api/advisor/subdomain/claim`) reserves the slug, sets activation flags when `SUBDOMAIN_AUTO_ACTIVATE` is enabled, and audits via `AdvisorBrandingAuditLog`.
4. Settings UI shows the full hostname (e.g. `ebilly-staging.akilirisk.com`).

Implementation: `src/lib/advisor/platform-subdomain.ts`, `src/proxy.ts`, `src/components/advisor/settings/SubdomainManager.tsx`.

## Vercel domains (recommended)

### Staging (Preview / `staging` branch)

| Domain | Purpose |
|--------|---------|
| `preview.akilirisk.com` | Platform app |
| `*.akilirisk.com` | All tenant hosts (`{slug}-staging.akilirisk.com` with suffix env) |

Do **not** add per-slug domains (`independent-wealth.akilirisk.com`, etc.) unless debugging; wildcard covers them. Bare `{slug}.akilirisk.com` on staging hits the deployment but **does not** resolve as a tenant when `TENANT_SUBDOMAIN_SUFFIX=-staging`.

### Production

| Domain | Purpose |
|--------|---------|
| `www.akilirisk.com` | Platform app |
| `akilirisk.com` | 307 → `www` |
| `*.akilirisk.com` | Tenant portals (`{slug}.akilirisk.com`) |

At launch: attach `*.akilirisk.com` to **Production** and **remove** it from Preview so production slugs are not served by staging.

## DNS

You control the `akilirisk.com` zone. Typical setup:

- Explicit `preview.akilirisk.com` → Vercel Preview
- Wildcard `*.akilirisk.com` → Vercel (environment determined by which Vercel env owns the wildcard)

`DEPLOYMENT_NOT_FOUND` from Vercel means the hostname is not on the project, not an app/database issue.

## Test fixtures (DB slugs)

`node scripts/seed-advisor-test-data.js` seeds canonical slugs only:

| Advisor | Slug | DB flags | Staging URL (with `-staging`) |
|---------|------|----------|-------------------------------|
| advisor2 | `independent-wealth` | active + verified | `https://independent-wealth-staging.akilirisk.com` |
| advisor3 | `inactive-tenant` | active, not DNS-verified | `https://inactive-tenant-staging.akilirisk.com` → "Subdomain Not Available" |
| advisor4 | `disabled-tenant` | verified, not active | `https://disabled-tenant-staging.akilirisk.com` → "Subdomain Not Available" |

Optional: `node scripts/seed-platform-reserved-subdomains.js` mirrors platform labels into `ReservedSubdomains`.

## Playwright / smoke tests

Default base URL: `https://preview.akilirisk.com` (`playwright.config.ts`).

`tests/smoke/subdomain-routing.spec.ts` builds tenant URLs with `TENANT_SUBDOMAIN_SUFFIX`. When the base URL is `preview.akilirisk.com`, Playwright sets `-staging` automatically if the env var is unset.

```bash
npm run test:e2e -- tests/smoke/subdomain-routing.spec.ts
```

Override:

```bash
TENANT_SUBDOMAIN_SUFFIX=-staging PLAYWRIGHT_BASE_URL=https://preview.akilirisk.com npm run test:e2e -- tests/smoke/subdomain-routing.spec.ts
```

For production-like smokes (no suffix): `TENANT_SUBDOMAIN_SUFFIX= PLAYWRIGHT_BASE_URL=https://www.akilirisk.com npm run test:e2e -- tests/smoke/subdomain-routing.spec.ts`

## Manual verification

```bash
curl -sI https://preview.akilirisk.com/ | head -1
curl -sI https://ebilly-staging.akilirisk.com/ | grep -E 'HTTP|x-matched-path'
# Expect x-matched-path: /branded/client-portal when slug is claimed and active
```

## Not implemented

- **Bring-your-own domain** (`customDomainEnabled`): flag only; no routing for non-`*.akilirisk.com` advisor-owned zones.
- **Per-advisor DNS verification**: not required for platform-owned `akilirisk.com`; activation is env-driven (`SUBDOMAIN_AUTO_ACTIVATE`).
