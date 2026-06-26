# AkiliRisk Mobile

The mobile **companion** app for the **AkiliRisk** family risk platform, built
with **Expo (React Native) + TypeScript**. It implements Phase 1 of the
*Akili Risk Mobile App Development Plan* (June 2026): clients complete the
household risk **intake** (Type or Voice, online or offline); advisors **review**
submitted intake on the go. Reporting, scoring, approval, and admin stay on the
web. See [`PLAN.md`](./PLAN.md) for the full plan-to-code mapping.

## Highlights

- **Magic-link auth** (`/api/auth/magic-link` → deep link → `/api/auth/verify`)
  with a **paste-code fallback** and **biometric unlock** for stored sessions.
- **Local-first intake** — answers commit to **SQLite + an outbox queue** with
  idempotency keys; a **sync worker** drains them when online. Works on a plane.
- **Type & Voice** answers (Expo AV), per-answer save status, offline banner,
  dead-letter retry, and submission gated on a fully-synced queue.
- **Advisor review** — client list with search/filters, read-only transcripts,
  inline voice playback via signed URLs, and "Approve & continue on web".

## Project structure

```
mobile/
├─ app/                          # expo-router routes
│  ├─ _layout.tsx                # providers + magic-link deep-link handler
│  ├─ index.tsx                  # auth/role router
│  ├─ (auth)/                    # sign-in, check-email (paste code), unlock (biometric)
│  ├─ (client)/                  # home, intake landing, wizard (Type/Voice), confirm
│  └─ (advisor)/                 # clients list, client/[id] read-only review
├─ src/
│  ├─ api/                       # fetch client (JWT + idempotency), auth, intake, advisor
│  ├─ auth/                      # SecureStore JWT, biometrics, auth state machine
│  ├─ db/                        # SQLite database, drafts, outbox queue
│  ├─ sync/                      # sync worker + NetInfo-driven SyncContext
│  ├─ audio/                     # Expo AV recorder hook
│  ├─ intake/                    # local-first save service
│  ├─ components/  theme/  hooks/  constants/  types/
│  └─ config.ts                  # API base URL resolution
├─ app.json   eas.json           # Expo + EAS build config
```

## Getting started

```bash
cd mobile
npm install
npx expo install --fix      # align native module versions to the installed Expo SDK

cp .env.example .env        # set EXPO_PUBLIC_API_BASE_URL
npm start                   # press i / a, or scan the QR in Expo Go / a dev build

npm run typecheck
npm run lint
```

> **Native modules** (SecureStore, LocalAuthentication, AV, SQLite, NetInfo)
> require a **development build** (`npx expo run:ios` / `run:android` or an EAS
> dev build), not plain Expo Go, to exercise biometrics and audio on device.

> **Local backend:** point `EXPO_PUBLIC_API_BASE_URL` at your machine's LAN IP
> (e.g. `http://192.168.1.20:3000`) when running the web app via `npm run dev`.

## Status & backend dependencies

This is a complete Phase-1 **client** aligned to the plan's architecture. It is
**not yet wired to a live backend**: the web app currently uses NextAuth
credentials+MFA and does not expose the magic-link / intake-script / presign
endpoints in the shape the app expects. The required backend work is listed in
[`PLAN.md` → "Backend follow-ups"]. The app has been written but **not yet
compiler-verified** here — run `npm install && npm run typecheck` first.

## Promoting to a standalone repository

This project is self-contained. To move it into its own repo:

```bash
git subtree split --prefix=mobile -b akilirisk-mobile
# then pull that branch into a fresh empty repo, or copy mobile/ and `git init`
```
