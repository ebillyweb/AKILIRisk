# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AkiliRisk is a Next.js 16+ risk assessment platform built with TypeScript, featuring multi-role access (clients, advisors, admins) and comprehensive risk analysis modules including family risk, cyber risk, identity risk, and intelligence assessments.

## Development Commands

```bash
# Install dependencies and generate Prisma client
npm install

# Development server
npm run dev

# Build for production
npm run build

# Production server
npm start

# Linting
npm run lint

# Testing
npm run test          # Run tests once
npm run test:watch    # Run tests in watch mode
```

## Database Operations

```bash
# Generate Prisma client after schema changes
npx prisma generate

# Create and apply migrations
npx prisma migrate dev --name descriptive-name

# Reset database (development only)
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio

# Pillar workbook tables (categories → sections → questions) — Belvedere Household Risk Profile DDL
# Prisma: PillarCategory / PillarSection / PillarQuestion → DB tables categories, sections, questions
# After `prisma migrate deploy`, load your Belvedere SQL into those tables (see migration 20260418120000;
# admin hide/show uses `questions.is_visible` from 20260419120000_questions_is_visible):
# npm run seed:pillar-ddl
# Default file: scripts/sql/belvedere-pillar-ddl-seed.sql — replace with your INSERTs or set PILLAR_DDL_SEED_PATH.
# When pillar DDL is seeded, `/api/assessment/governance-questions` reads the `questions` table.
# npx prisma migrate deploy   # or migrate dev after pulling migrations
#
# If migrate fails with P3009 on `20260410000001_cybersecurity_assessment_bank`, pull latest migrations
# then from repo root: `npm run db:fix-cyber-migration` (marks rolled back + runs migrate deploy).
#
# If deploy then fails with P3018 on `20260410180000_enhanced_assessment_engine` (e.g. type already exists),
# run: `npm run db:fix-enhanced-migration` — that migration SQL is idempotent for partial Neon replays.

# Assessment bank (spreadsheet is source of truth)
# Place Belvedere_Household_Risk_Profile.xlsx at repo root, or set BELVEDERE_WORKBOOK_PATH in .env.local.
# Tab names must match scripts/lib/belvedere-workbook.ts (Governance, Cyber, Physical, …).
npm run seed:pillar-ddl
# Deprecated alias (runs seed:pillar-ddl): npm run seed:assessment-bank
# Full deploy (migrations + workbook import + rules): npx tsx scripts/deploy-complete-assessment-system.ts
# Deploy requires the workbook; there is no legacy fallback path.
# Optional: import Reputational & social risk rows from a structured .xlsx (SpreadsheetImporter):
# REPUTATIONAL_SOCIAL_IMPORT_PATH=./path/to/questions.xlsx npm run import:reputational-social
# Starter CSV: examples/reputational-social-import-template.csv

# Seed test data (run in order)
node scripts/seed-advisor-test-data.js
node scripts/seed-invite-code.js
node scripts/set-advisor-role.js
node scripts/set-admin-role.js
# One-off: reassign SUBMITTED intake from advisor login → assigned client (`scripts/migrate-intake-to-client.js`)
# DRY_RUN=1 npm run db:migrate-intake-to-client
# Optional: CLIENT_EMAIL=buddy+client2@ebilly.com INTERVIEW_ID=<cuid>
# Optional: platform-reserved subdomain labels (preview, www, app, …)
node scripts/seed-platform-reserved-subdomains.js
```

### White-label subdomains

Platform-owned tenant hosts under `PRODUCTION_DOMAIN` (see `docs/white-label-subdomains.md`):

- **Preview / staging:** `TENANT_SUBDOMAIN_SUFFIX=-staging`, `SUBDOMAIN_AUTO_ACTIVATE=true`, platform app at `preview.akilirisk.com`, tenants at `{slug}-staging.akilirisk.com`.
- **Production:** omit `TENANT_SUBDOMAIN_SUFFIX`; tenants at `{slug}.akilirisk.com`.
- **Vercel:** `*.akilirisk.com` on one environment at a time (Preview while staging; move to Production at launch). Keep `preview.akilirisk.com` on Preview only.
- **Code:** `src/lib/advisor/platform-subdomain.ts`, `src/proxy.ts`, `/api/advisor/subdomain/claim`.

## Architecture & Structure

### Application Structure
- **App Router**: `/src/app` with route groups `(auth)` and `(protected)`
- **Components**: `/src/components` organized by domain (admin, advisor, assessment, etc.)
- **Business Logic**: `/src/lib` with domain-specific modules (actions, analytics, assessment, etc.)
- **Database**: PostgreSQL with Prisma ORM (`/prisma/schema.prisma`)

### Key Patterns
- **Path Aliases**: Use `@/*` for imports from `/src`
- **Server Actions**: Located in `/src/lib/actions` for database operations
- **Authentication**: NextAuth with MFA support (`/src/lib/auth.ts`)
- **Database Access**: Always use Prisma client from `/src/lib/db.ts`
- **UI Components**: shadcn/ui components in `/src/components/ui`

### Role-based Architecture
- **USER**: Default client role with assessment access
- **ADVISOR**: Subscriber-facing advisor portal (UI may label “Subscriber”); DB enum `ADVISOR`
- **ADMIN**: Platform staff admin (`/admin`) except super-admin-only settings
- **SUPER_ADMIN**: Highest privilege; platform-wide feature flags and risk thresholds (`requireSuperAdminRole` in `src/lib/admin/auth.ts`)

## Key Modules

### Risk Assessment Types
- **Family Risk**: Household member analysis (`/src/lib/family`)
- **Cyber Risk**: Digital security assessment (`/src/lib/cyber-risk`)
- **Identity Risk**: Personal information security (`/src/lib/identity-risk`)
- **Intelligence**: Risk intelligence analysis (`/src/lib/intelligence`)

### Core Functionality
- **Intake System**: Client onboarding with questionnaires (`/src/lib/intake`)
- **Assessment Engine**: Multi-stage risk evaluation (`/src/lib/assessment`)
- **Advisor Tools**: Client management and review workflows (`/src/lib/advisor`)
- **Document Generation**: PDF reports and templates (`/src/lib/documents`)
- **Pipeline**: Assessment workflow management (`/src/lib/pipeline`)

## Test Credentials

Use these credentials for local development testing:

| Role | Email | Password | Notes |
|------|--------|----------|--------|
| **Advisor** | `advisor@test.com` | `testpassword123` | Access Advisor Hub/Portfolio |
| **Advisor (no clients)** | `advisor2@test.com` | `testpassword123` | Slug `independent-wealth` (active+verified). Staging URL: `independent-wealth-staging.akilirisk.com`. |
| **Advisor (unverified subdomain)** | `advisor3@test.com` | `testpassword123` | Slug `inactive-tenant` (not verified). Staging: `inactive-tenant-staging.akilirisk.com`. Billing-gate fixture (`tests/fixtures/users.ts`). |
| **Advisor (deactivated subdomain)** | `advisor4@test.com` | `testpassword123` | Slug `disabled-tenant` (inactive). Staging: `disabled-tenant-staging.akilirisk.com`. |
| **Advisor (no branding)** | `advisor-unbranded@test.com` | `testpassword123` | `brandingEnabled=false` on profile. Used by the default-branding-fallback test. |
| **Client (no branding)** | `client-unbranded@test.com` | `testpassword123` | Assigned to `advisor-unbranded`; their dashboard renders the default Akili lockup instead of an advisor portal. |
| **Client** | `client@test.com` | `testpassword123` | Standard client account (SUBMITTED + Approved intake) |
| **Client (MFA)** | `client-mfa@test.com` | `testpassword123` | For MFA flow testing |
| **Client (fresh)** | `client-fresh@test.com` | `testpassword123` | No intake row; used by Playwright intake tests. Reset via `node scripts/reset-fresh-client-intake.js` |
| **Super admin** | `buddy@ebilly.com` | `Test1111!` | Full admin + platform settings (`node scripts/set-admin-role.js` sets `SUPER_ADMIN`) |

### Invite Codes
- **123456**: Generic signup code
- **BELV01**: Prefills `buddy+belvcustomer@ebilly.com` on signup

## Development Notes

### Environment Setup
- **Identity for this repo**: Git author `buddy@ebilly.com` (`git config --local`). **AWS** for Akili is the same org: use CLI profile **`ebilly`** in `~/.aws/config` (SSO or keys for `buddy@ebilly.com`). This workspace sets `AWS_PROFILE=ebilly` for integrated terminals (`.vscode/settings.json`). Runtime S3 in `.env.local` should use IAM keys from that account too.
- **Cursor / VS Code profile**: Import `profiles/akili-ebilly.code-profile` or rely on `.vscode/settings.json` (`AWS_PROFILE=buddy@ebilly.com`). The profile must be fully configured for SSO in `~/.aws/config` (see `profiles/aws-profile-akili.snippet`); then `aws sso login --profile buddy@ebilly.com`.
- **Shell themes** (e.g. Starship) may export `AWS_PROFILE` for another org. The CORS script **does not** use that: it picks `AKILI_AWS_PROFILE`, or `./akili.awsprofile` (copy from `akili.awsprofile.example`), or a profile named `ebilly` if defined in `~/.aws/config`. Template: `profiles/aws-profile-akili.snippet`.
- Copy `.env.example` to `.env.local` and configure
- Database: PostgreSQL connection via `DATABASE_URL`
- Auth: NextAuth secret via `AUTH_SECRET`
- Email: Optional Resend API key for notifications
- OpenAI: API key for AI-powered risk analysis

### Testing Flows
1. **Client Assessment**: Home → Start Assessment → Enter invite code → Complete intake → Advisor review
2. **Advisor Workflow**: Sign in → Advisor Hub → Portfolio → Client management
3. **Admin Functions**: Admin nav → Advisors/Clients/Assessment Management
4. **MFA Setup**: Client Settings → Enable Two-Factor Authentication

### Code Quality
- ESLint configured with Next.js and TypeScript rules
- Unused variables prefixed with `_` are ignored
- Vitest for unit testing with global test environment
- TypeScript strict mode enabled

## Common Patterns

### Database Queries
```typescript
// Always import from lib/db
import { prisma } from '@/lib/db'

// Use Prisma client for all database operations
const user = await prisma.user.findUnique({ where: { email } })
```

`@/lib/db` exports both `prisma` (canonical) and a `db` alias; the codebase
uses `prisma` everywhere — prefer it in new code.

### Server Actions
```typescript
// Place in /src/lib/actions directory
'use server'

export async function createAssessment(data: FormData) {
  // Server action implementation
}
```

### Authentication Checks
```typescript
// Use auth helper for session management
import { auth } from '@/lib/auth'

const session = await auth()
if (!session?.user) redirect('/auth/signin')
```
