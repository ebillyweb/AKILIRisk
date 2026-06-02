# Access Levels by Role

Summary of what each role can see and do. All protected routes require an authenticated session.

---

## Roles

| Role   | Typical use           | Default for sign-up |
|--------|------------------------|----------------------|
| **USER**   | Client (family, wealth owner) | Yes |
| **ADVISOR** | Advisor (assigned clients, reviews, governance) | No (set in DB/seed) |
| **ADMIN**  | Designated admin only (buddy@ebilly.com); has Admin area + Advisor access | No (set via script) |

---

## USER (client)

**Nav:** Dashboard, Intake, Assessment, Profiles, Settings.

| Area | Access |
|------|--------|
| **Dashboard** (`/dashboard`) | Own dashboard: assessments list, progress, account summary, links to results/settings. |
| **Intake** (`/intake`, `/intake/interview`, `/intake/complete`) | Own intake interview only. |
| **Assessment** (`/assessment`, `/assessment/.../results`, etc.) | Own assessment(s) only; creation and progress scoped to `session.user.id`. |
| **Profiles** (`/profiles`) | Own household members only. |
| **Settings** (`/settings`) | Own account, MFA, email. |
| **Advisor routes** (`/advisor`, `/advisor/dashboard`, etc.) | **No access.** Layout redirects to `/dashboard?error=unauthorized`. |
| **APIs** | Assessment, intake, reports, templates: all scoped by `session.user.id` or interview/assessment ownership. Clients cannot see other users’ data. |

**Makes sense:** Clients see only their own data and flows; no advisor menu or advisor-only routes.

---

## ADVISOR (and ADMIN)

**Nav:** Subscriber hub, Invitations, Dashboard (when enabled), Risk Intelligence (when enabled), Notifications, Billing, Settings — not client Intake / Assessment / Profiles.

| Area | Access |
|------|--------|
| **Advisor Hub** (`/advisor`) | Advisor dashboard: assigned clients, pending reviews, notifications. Guarded by `advisor/layout.tsx` and `requireAdvisorRole()` in actions. |
| **Portfolio** (`/advisor/dashboard`) | Governance/portfolio dashboard. Same guards; data via `getGovernanceDashboardData()` (assigned clients only). |
| **Advisor review/notifications** | `/advisor/review/[id]`, `/advisor/notifications`. Review assigned clients’ submitted intakes here — not `/intake`. |
| **Client dashboard** (`/dashboard`) | Redirects to `/advisor` (or `/admin` for platform staff). |
| **Client routes** (`/intake`, `/assessment`, `/profiles`, `/documents`) | **No access.** Layouts call `redirectPathUnlessClientRole()`; intake server actions and intake mutation APIs require `USER`. |
| **Settings** (`/settings`, `/advisor/settings`) | Account and MFA via advisor settings. |
| **APIs** | Advisor data via `requireAdvisorRole()`. Intake audio stream GET still allows advisors with an assignment (review playback). Intake upload/transcribe/submit are client-only. |

**Makes sense:** Advisors work in the hub; clients complete intake and assessment on their own accounts.

---

## ADMIN (designated admin: buddy@ebilly.com only)

**Nav:** Admin workspace (and advisor hub when applicable). Not client `/intake` or `/assessment`.

| Area | Access |
|------|--------|
| **Admin** (`/admin`) | Admin-only area; guarded by `admin/layout.tsx` and `requireAdminRole()`. Only the user with email `buddy@ebilly.com` and role ADMIN can access. Placeholder for user/role management. |
| **Advisor routes** | Same as ADVISOR (can use Advisor Hub, Portfolio, review, notifications). |
| **Session** | If the DB has `role: ADMIN` for any other email, the session callback in `lib/auth.ts` forces their role to USER so only buddy@ebilly.com ever gets ADMIN in the app. |

**Makes sense:** ADMIN is distinct (has its own Admin area) and is locked to one account.

---

## Things to decide

1. **“Client View” for advisors**  
   Right now, visiting `/dashboard` as an advisor redirects to `/advisor`, so the “Client View” nav item never shows the client dashboard. Options:  
   - **A)** Remove the redirect for advisors so “Client View” shows their own client-style dashboard (e.g. their own assessments if they have any).  
   - **B)** Remove “Client View” from the advisor nav if they should only use Advisor Hub and Portfolio.

2. **ADMIN (buddy@ebilly.com)**  
   ADMIN is a distinct role restricted to the designated admin account (buddy@ebilly.com). Only that user sees the "Admin" nav item and can access `/admin`. Session callback in `lib/auth.ts` strips ADMIN from any other user. Use `scripts/set-admin-role.js` to create or set the admin user.

3. **Advisors and client routes**  
   **Done:** Client `/intake`, `/assessment`, `/profiles`, and `/documents` are `USER`-only (layouts + intake actions/APIs). Advisors review client intakes at `/advisor/review/[id]` and manage the script at `/admin/intake/questions`.

---

## Guard summary

| Guard | Where | What it does |
|-------|--------|----------------|
| **Protected layout** | `(protected)/layout.tsx` | No session → redirect to `/signin`. |
| **Advisor layout** | `(protected)/advisor/layout.tsx` | Role not ADVISOR/ADMIN → redirect to `/dashboard?error=unauthorized`. |
| **Dashboard page** | `(protected)/dashboard/page.tsx` | Role ADVISOR/ADMIN → redirect to `/advisor` (so they land on Advisor Hub). |
| **Admin layout** | `(protected)/admin/layout.tsx` | Only allows access if `isAdminUser(email, role)` (ADMIN + buddy@ebilly.com). |
| **requireAdvisorRole()** | `lib/advisor/auth.ts` | Used by all advisor server actions; throws if not ADVISOR/ADMIN. |
| **requireAdminRole()** | `lib/admin/auth.ts` | Used for admin-only actions; throws unless ADMIN and email is buddy@ebilly.com. |
| **Client-only routes** | `intake/layout.tsx`, `assessment/layout.tsx`, `profiles/layout.tsx`, `documents/layout.tsx` | `redirectPathUnlessClientRole()` sends staff to `/advisor` or `/admin`. |
| **API ownership** | Assessment, intake, reports, templates APIs | Compare `assessment.userId` or interview owner to `session.user.id`; intake mutations also require `USER`. |

Role is normalized (`.toString().toUpperCase()`) in layout and advisor auth so “ADVISOR”/“ADMIN” match regardless of casing from the DB/JWT.
