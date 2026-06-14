# AkiliRisk Mobile — Implementation Plan & Status

> **Source of truth:** *Akili Risk Mobile App Development Plan* (v1.0, June 13 2026),
> Google Drive `Akili_Risk_Mobile_App_Plan.docx`. This file maps that plan to the
> code in this repo and tracks what is implemented vs. outstanding.

## What the app is (per the plan)

A focused **companion** to the AkiliRisk web platform — **not** a replacement.
Phase 1 lets **clients complete the household risk intake** on a phone (Type or
Voice, online or offline) and lets **advisors read submitted intake** on the go.
Everything consequential — reporting, scoring, approval, configuration, billing —
**stays on the web**.

## Phase 1 scope ↔ implementation

| Plan area | Where in this repo | Status |
| --- | --- | --- |
| §4.1 Magic-link sign-in + paste-code fallback | `app/(auth)/sign-in.tsx`, `check-email.tsx`, `src/api/auth.ts`, deep-link handler in `app/_layout.tsx` | ✅ |
| §4.1 JWT in SecureStore + biometric unlock | `src/auth/secureStore.ts`, `biometric.ts`, `AuthContext.tsx`, `app/(auth)/unlock.tsx` | ✅ |
| §4.2 Client home (Begin / Resume / Submitted) | `app/(client)/home.tsx` | ✅ |
| §4.2 Intake landing (count, time, privacy) | `app/(client)/intake/index.tsx` | ✅ |
| §4.2 Per-question Type & Voice tabs | `app/(client)/intake/wizard.tsx`, `src/components/{ModeTabs,VoiceAnswer}.tsx`, `src/audio/useAudioRecorder.ts` | ✅ |
| §4.2 Per-answer save status (Saved/Synced/Queued/Failed) | `src/components/SaveStatusPill.tsx` | ✅ |
| §4.2 Offline banner + pending summary | `src/components/OfflineBanner.tsx` | ✅ |
| §4.2 Submission confirmation + reference ID | `app/(client)/intake/confirm.tsx` | ✅ |
| §4.3 Advisor client list + search + filters | `app/(advisor)/clients.tsx` | ✅ |
| §4.3 Read-only transcripts + inline voice playback | `app/(advisor)/client/[id].tsx`, `src/components/AudioPlayButton.tsx` | ✅ |
| §4.3 Pillar tags | `src/components/PillarChip.tsx`, `src/constants/pillars.ts` | ✅ |
| §4.3 "Approve & continue on web" | `app/(advisor)/client/[id].tsx` (opens web console) | ✅ |
| §8 Local-first: SQLite drafts + outbox + idempotency | `src/db/{database,drafts,outbox}.ts`, `src/intake/service.ts` | ✅ |
| §8.2 Sync worker + conflict rules + dead-letter | `src/sync/syncWorker.ts`, `src/sync/SyncContext.tsx` | ✅ |
| §6 EAS Build profiles | `eas.json` | ✅ (scaffold) |

### Deliberately excluded in Phase 1 (per §2 / §4.4)
Score views, recommendations, PDF reports, billing/Stripe, admin surfaces,
advisor configuration, push notifications, tablet layouts, white-label apps.

## Technology stack (plan §5)

Expo SDK 53 (managed) · TypeScript strict · Expo Router · TanStack Query ·
React Hook Form + Zod · Expo SecureStore · Expo LocalAuthentication · Expo AV ·
Expo SQLite · `@react-native-community/netinfo` · EAS Build/Submit/Update ·
Sentry (to be wired) · Jest + RNTL (tests, post-scaffold).

> **UI primitives** are an open question in the plan (Tamagui vs. RN Paper, §13).
> This scaffold uses lightweight in-repo components (`src/components`,
> `src/theme`) so the choice can be made without reworking screens.

## Architecture (plan §6, §8)

The app is a thin, **local-first** client over the existing Next.js backend.

```
UI ──save──▶ SQLite (drafts)  ──enqueue──▶ outbox (UUID idempotency key)
                                              │
NetInfo online / app-foreground ──▶ sync worker drains outbox in order
   • TYPE  → POST /api/intake/response (Idempotency-Key)
   • VOICE → presign → PUT S3 → POST /api/intake/response → evict local file
   • 4xx (perm) → dead-letter + mark draft FAILED
   • offline/5xx → stop, retry on reconnect
Submission blocked until every draft is SYNCED.
```

Conflict rule (plan §8.2): server `updatedAt` wins on first sync; idempotency
keys make retries safe; responses are append-only per `(interviewId, questionId)`.

## API contract the client expects

Phase 1 reuses Next.js routes; some need a thin mobile-friendly shape. The
client is written to this contract (isolated in `src/api/*`):

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/magic-link` | send magic link + 6-digit code |
| POST | `/api/auth/verify` | exchange `{token}` or `{email,code}` → `{token,user}` |
| GET | `/api/auth/session` | resolve current user (bearer) |
| GET | `/api/intake/script` | `{interviewId,status,questions[]}` |
| POST | `/api/intake/response` | upsert typed/voice answer (idempotent) |
| POST | `/api/intake/audio/presign` | `{uploadUrl,fileKey}` for voice upload |
| POST | `/api/intake/submit` | finalize → `{referenceId}` |
| GET | `/api/advisor/clients` | assigned clients |
| GET | `/api/advisor/clients/:id/intake` | read-only transcript |
| GET | `/api/advisor/clients/:id/audio/:qid` | signed playback URL |

## Backend (implemented in the web app — `../src`)

The matching backend endpoints now live in the AkiliRisk Next.js app:

| Concern | Implementation |
| --- | --- |
| Bearer auth + cookie fallback | `src/lib/mobile/token.ts` (`resolveUser`, HMAC token) |
| Magic-link + paste-code | `src/lib/mobile/magic-link.ts`, `src/app/api/auth/{magic-link,verify}/route.ts`, `sendMagicLinkEmail` in `src/lib/email.ts` |
| Session refresh | `src/app/api/mobile/me/route.ts` |
| Intake script / response / submit | `src/app/api/intake/{script,response,submit}/route.ts` |
| Voice presign | `src/app/api/intake/audio/presign/route.ts` + `generateUploadUrlForKey` in `src/lib/documents/s3.ts` |
| Advisor read endpoints | `src/app/api/advisor/clients/**` + `src/lib/mobile/advisor.ts` (tenant isolation) |
| Schema | `IntakeResponse.textResponse` column (migration `20260614120000_intake_text_response`) |

Auth issues a stateless HMAC bearer token (AUTH_SECRET, 30-day TTL); the mobile
endpoints accept it **or** a NextAuth cookie session, so they serve app + web.
Apply the migration with `npx prisma migrate deploy`. Remaining ops items
(plan §13): universal/app-link `apple-app-site-association` + `assetlinks.json`
on the link host, and `MOBILE_LINK_BASE_URL` env. A dedicated `/api/mobile/v1/*`
surface remains the plan's **Phase 2** item (§12.3).

## 12-week delivery plan (plan §10)

Weeks 1–2 scaffold+auth · 3–5 Type intake · 6–7 Voice · 8–9 offline · 10 advisor ·
11 internal testing · 12 store submission. This scaffold front-loads the
weeks 1–10 architecture so feature work lands on a stable base.

## Phase 2 roadmap (plan §12)
Push notifications · per-advisor white-label apps · dedicated mobile API ·
mobile reporting/score view · (admin deferred indefinitely).
