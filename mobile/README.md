# AkiliRisk Mobile

The mobile companion app for the **AkiliRisk** family risk governance platform,
built with **Expo (React Native) + TypeScript** and **expo-router**.

It lets clients sign in, view their composite risk profile across the four risk
pillars (Family Governance, Cyber, Identity, Intelligence), and drill into
individual assessments and recommended controls — all backed by the existing
AkiliRisk web API.

---

## Tech stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| Runtime        | Expo SDK 52 / React Native 0.76          |
| Language       | TypeScript (strict)                      |
| Navigation     | expo-router (typed routes, file-based)   |
| Data fetching  | @tanstack/react-query                    |
| Validation     | zod (mirrors backend Prisma enums)       |
| Secure storage | expo-secure-store                        |
| Auth           | NextAuth credentials (cookie session)    |

## Project structure

```
mobile/
├─ app/                       # expo-router routes (file-based)
│  ├─ _layout.tsx             # providers (QueryClient, Auth, SafeArea) + Stack
│  ├─ index.tsx               # auth-aware entry redirect
│  ├─ (auth)/                 # sign-in, MFA
│  ├─ (tabs)/                 # dashboard, assessments, profile
│  └─ assessment/[id].tsx     # assessment detail + pillar breakdown
├─ src/
│  ├─ api/                    # fetch client, auth, assessments, react-query setup
│  ├─ auth/                   # AuthContext + secure-store session cache
│  ├─ components/             # reusable brand-styled UI
│  ├─ constants/pillars.ts    # canonical pillar metadata (matches backend keys)
│  ├─ theme/                  # palette, spacing, risk-level colors
│  ├─ types/                  # zod schemas / inferred types
│  └─ config.ts               # API base URL resolution
└─ app.json                   # Expo config
```

## Getting started

```bash
cd mobile
npm install

# Point the app at your API (defaults to https://app.akilirisk.com)
cp .env.example .env
# edit EXPO_PUBLIC_API_BASE_URL as needed

npm start            # then press i / a, or scan the QR with Expo Go
npm run typecheck    # tsc --noEmit
npm run lint
```

> **Local backend:** When running the web app via `npm run dev`, set
> `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP (e.g.
> `http://192.168.1.20:3000`) so a device or simulator can reach it —
> `localhost` resolves to the device itself, not your dev machine.

## How auth works

The web backend uses **NextAuth** with the credentials provider and a
**cookie-based session**. The app:

1. fetches a CSRF token (`/api/auth/csrf`),
2. posts credentials to `/api/auth/callback/credentials`,
3. reads the resolved session (`/api/auth/session`).

React Native's native networking layer keeps a shared cookie jar, so the
session cookie is replayed automatically on later requests. MFA-enabled
accounts are routed through the verification screen before reaching the tabs.

See [`PLAN.md`](./PLAN.md) for the architecture rationale, roadmap, and the
recommended backend follow-ups (a dedicated mobile token endpoint, push
notifications, on-device assessment authoring).

## Promoting to a standalone repository

This project is self-contained (its own `package.json`, `tsconfig`, Expo
config). To move it into its own GitHub repo once one exists:

```bash
# from the monorepo root
git subtree split --prefix=mobile -b akilirisk-mobile
cd /tmp && git clone <new-empty-repo-url> akilirisk-mobile && cd akilirisk-mobile
git pull <path-to-AKILIRisk-repo> akilirisk-mobile
git push origin main
```

Or simply copy the `mobile/` directory into a fresh repo and `git init`.
