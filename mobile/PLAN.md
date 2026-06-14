# AkiliRisk Mobile — Build Plan

This document captures the architecture and roadmap for the AkiliRisk mobile
companion app. Phase 0 (the foundation + core client experience) is implemented
in this commit; later phases are scoped for follow-up work.

## Goals

- Give clients a fast, secure, read-first view of their family risk profile.
- Reuse the existing AkiliRisk web API rather than forking business logic.
- Keep the domain model in lockstep with the backend (pillars, risk levels,
  assessment status) so the two clients never drift.
- Ship a foundation that an advisor-facing surface and richer authoring can be
  layered onto.

## Architecture decisions

| Decision | Rationale |
| --- | --- |
| **Expo (managed)** | Fastest path to iOS + Android from one TS/React codebase; OTA updates via EAS; matches the team's existing React/TypeScript skills. |
| **expo-router** | File-based, typed routes; mirrors the App Router mental model from the web app. |
| **react-query** | Caching, background refetch, and pull-to-refresh with minimal boilerplate; centralizes auth-error handling (no retry on 401/403). |
| **zod schemas as the type source** | The API is untyped over the wire; parsing at the boundary catches backend drift early and yields inferred TS types. |
| **Cookie-session auth via native cookie jar** | Reuses NextAuth as-is with zero backend changes for v0. See "Backend follow-ups" for the token-based upgrade. |
| **expo-secure-store** | Encrypted at-rest cache of the session user for instant cold-start hydration. |

## Domain model (mirrors backend)

- **Pillars:** `family-governance`, `cyber-risk`, `identity-risk`, `intelligence`
  (`src/constants/pillars.ts`).
- **Risk levels:** `LOW` → `MEDIUM` → `HIGH` → `CRITICAL` with brand colors
  (`src/theme/colors.ts`).
- **Assessment status:** `IN_PROGRESS` / `COMPLETED` / `ARCHIVED`.

## API surface consumed (v0)

| Endpoint | Use |
| --- | --- |
| `GET /api/auth/csrf` | CSRF token for credential sign-in |
| `POST /api/auth/callback/credentials` | Credential sign-in |
| `GET /api/auth/session` | Resolve current user |
| `POST /api/auth/mfa/verify` | MFA verification |
| `POST /api/auth/signout` | Sign out |
| `GET /api/assessment` | List the user's assessments |
| `GET /api/assessment/:id` | Assessment detail + pillar scores |

## Phases

### Phase 0 — Foundation & client read experience ✅ (this commit)
- Expo + expo-router scaffold, strict TS, theming, reusable components.
- Auth: sign-in, MFA, session persistence, auth-guarded tabs.
- Dashboard: composite score + per-pillar snapshot.
- Assessments: list + detail with pillar breakdown and recommended controls.
- Profile: account info + sign out.

### Phase 1 — Hardening & DX
- Add app icon / splash assets and EAS build profiles (`eas.json`).
- Unit tests (zod parsers, score aggregation) via jest-expo.
- Error/telemetry (Sentry) and offline cache persistence for react-query.
- Empty/error-state polish and accessibility pass.

### Phase 2 — Notifications & engagement
- Push notifications (expo-notifications) for advisor messages, workflow stage
  changes, and document-request reminders (backend triggers already exist).
- Deep links from notifications into the relevant assessment/pillar.

### Phase 3 — On-device assessment authoring
- Render the question bank and capture responses with auto-save
  (`/api/assessment/:id/responses`), reusing the web branching logic.
- Audio intake responses (expo-av) feeding the existing transcription pipeline.

### Phase 4 — Advisor surface
- Advisor login → portfolio list, client drill-down, and review/approval
  actions, gated on `role === 'ADVISOR'`.
- Advisor branding (logo/colors) applied dynamically per the branding API.

## Backend follow-ups (recommended)

1. **Dedicated mobile auth** — issue a signed bearer/refresh token from a
   `/api/mobile/auth/login` endpoint so the app isn't coupled to NextAuth's
   CSRF + cookie flow (more robust across RN networking edge cases and easier
   to test). The current client isolates auth in `src/api/auth.ts`, so this is
   a localized change.
2. **Scores endpoint shape** — return a stable, documented JSON contract for
   `GET /api/assessment/:id` including `scores[]` with `breakdown` and
   `missingControls` typed consistently.
3. **CORS / mobile origin** — confirm the API accepts the app's requests when
   pointed at non-production hosts during development.
4. **Push token registration** — add an endpoint to store Expo push tokens per
   user for Phase 2.

## Out of scope (for now)
- Payments/Stripe flows (advisor-side, web-first).
- Document upload UI (S3 presigned flow exists; deferred to Phase 3+).
