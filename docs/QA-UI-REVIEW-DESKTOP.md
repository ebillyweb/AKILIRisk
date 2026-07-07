# QA & UI Review — Desktop (New Screens)

Focus: **desktop view** for the main client and auth flows.  
Screens: Home, Auth (sign-in/sign-up), Dashboard, Intake (landing, interview, complete), Assessment (hub, question, results), Profiles, Settings.

---

## 1. QA Findings

### 1.1 Auth & session

| Area | Status | Notes |
|------|--------|--------|
| Sign-in redirect | OK | Redirects to `callbackUrl` or `/dashboard`; `router.refresh()` after sign-in. |
| Sign-up → auto sign-in | OK | Creates account then signs in and redirects to dashboard/callbackUrl. |
| Protected layout | OK | Redirects to `/signin` when no session; nav and “Signed in as” reflect session. |
| Sign-out | OK | Server action signs out and redirects to `/`. |

**Recommendation:** Add `aria-live` or a brief success message (e.g. toast) after sign-in so screen-reader and sighted users get confirmation before redirect.

---

### 1.2 Intake flow

| Area | Status | Notes |
|------|--------|--------|
| Start interview | OK | Server action starts interview and redirects to `/intake/interview`. Active interview check redirects from `/intake` to interview. |
| Load interview | OK | Fetches active interview and details; redirects to `/intake` if none. Loading and error states with toast. |
| Record → upload → transcribe | OK | Upload, then transcribe; audio saved even if transcription fails; user sees “Audio saved. Transcription will be processed later.” |
| Edit transcript / save | OK | Validation and error messaging (e.g. from schema) surfaced via toast. |
| Last question submit | OK | Submits interview and redirects to `/intake/complete`. |
| Navigation | OK | Previous/Next; Next disabled until response saved; completed steps reflected. |

**Edge case:** If the user has an active interview but the **detail** fetch fails, they see “Failed to load interview” and are sent to `/intake`; they may need to “Begin Interview” again. Consider retry or clearer copy (“We couldn’t load your progress; you can start a new interview or try again”).

---

### 1.3 Assessment flow

| Area | Status | Notes |
|------|--------|--------|
| Hub load | OK | Rehydration fetch has 12s timeout and error handling; 15s safety timeout prevents infinite loading. |
| Create assessment | OK | POST creates assessment; store updated; redirect to first question. |
| Continue / resume | OK | Smart resume to next unanswered question; “Review from Start” and “Continue” both available. |
| Question page | OK | Redirect when no `assessmentId`; invalid index redirects to first question or hub. |
| Auto-save | OK | Debounced save; `isSaving` reflected in UI. |
| Results | OK | Fetches or calculates score; loading state; error state with message. |

**Recommendation:** If rehydration times out or fails, consider a small inline message (e.g. “We couldn’t load your previous progress; you can continue from here”) so users know why data might look empty.

---

### 1.4 Profiles & settings

| Area | Status | Notes |
|------|--------|--------|
| Profiles list | OK | Server loads members; client state for add/edit. |
| Settings | OK | MFA status, recovery codes count; “Planned” controls clearly labeled as not implemented. |

**Recommendation:** Settings “Change Password” and “Regenerate recovery codes” could link to a “Coming soon” or roadmap note so expectations are clear.

---

### 1.5 Accessibility & forms

| Area | Status | Notes |
|------|--------|--------|
| Labels | OK | Email/password inputs have `<Label htmlFor=...>`. |
| Password visibility | OK | `PasswordInput` with show/hide and `aria-label` / `aria-pressed`. |
| Error display | OK | Auth errors in `<Alert variant="destructive">` with description. |
| Loading states | OK | Buttons show “Signing in…”, “Creating account…”, etc.; assessment hub has skeleton. |

**Gaps:**  
- Auth panels: no `aria-describedby` linking description to form.  
- Intake/assessment: no `aria-live` for “Saving…”, “Response saved”, or score loading.  
- Focus order on modals or multi-step flows (e.g. intake interview) not verified.

---

## 2. UI Review (Desktop)

### 2.1 Layout & structure

- **Home:** Two-column grid at `lg`; hero left, aside right; cards and CTAs clear.  
- **Auth layout:** Split layout; form right, editorial left; `max-w-xl` form container.  
- **Protected layout:** Header with kicker, title, “Signed in as”, nav (Dashboard, Intake, Advisor if role, Assessment, Profiles, Settings), main content with consistent padding (`px-4 sm:px-8 lg:px-10`, etc.).  
- **Dashboard:** Hero + stats card; two-column content (assessments list, account settings).  
- **Assessment hub:** Hero, optional welcome alert, progress card, pillar card, next-step CTA.  
- **Intake interview:** Centered single column (`max-w-3xl`); step indicator, question, recorder card, nav.  
- **Results:** Score, risk drivers, action plan, download/templates.  

**Verdict:** Structure is consistent; hero + card + CTA pattern repeats. Desktop widths (`max-w-5xl`, `max-w-6xl`, `max-w-2xl`) are appropriate.

---

### 2.2 Typography & hierarchy

- **Kicker:** `editorial-kicker` used for AKILI Risk Management”, “Client Dashboard”, “Assessment Workspace”, etc.  
- **H1:** Large (e.g. `text-3xl sm:text-5xl`), `text-balance` where used.  
- **Body:** `text-muted-foreground` for secondary copy; descriptions under cards.  

**Minor:** Some pages use `text-2xl` for card titles, others `text-3xl` (e.g. Dashboard “Your Assessments” vs “Account Settings”). Consider standardizing card section titles (e.g. one scale for “Section title” and one for “Card title”).

---

### 2.3 Spacing & density

- Sections: `space-y-6 sm:space-y-8` common.  
- Cards: `p-4 sm:p-8`, `pt-6`, `CardContent` spacing consistent.  
- Buttons: `gap-2` / `gap-3` in button groups; nav uses `gap-2 sm:gap-3`.  

**Verdict:** Comfortable on desktop; no obvious overcrowding or excessive whitespace.

---

### 2.4 Design tokens & consistency

- **Tokens in use:** `hero-surface`, `section-divider`, `editorial-kicker`, `background/55`, `bg-background/60`, borders and radius from theme.  
- **Intake complete page:** Uses hardcoded `bg-green-100`, `text-green-600`, `bg-blue-50`, `border-blue-200`, `text-blue-600`, `text-blue-900`, `text-blue-800` instead of semantic tokens (`success`, `info`, or `muted`).  

**Recommendation:** Replace with theme-aware classes (e.g. `bg-primary/10`, `text-primary`, or success/info variants) so intake complete matches the rest of the app and respects dark mode.

---

### 2.5 Buttons & CTAs

- Primary vs outline usage is consistent (primary for main action, outline for secondary).  
- “Begin Assessment”, “Continue Assessment”, “Sign In”, “Create Account” are clear.  
- Home: “Go to Dashboard” + “Sign Out” when signed in; “Sign In” + “Create Account” when not.  

**Minor:** Home and intake complete use `<Link>` with icon inside; Button already has `gap-2` and `items-center`, so icon and text align. No change required; keep same pattern elsewhere (e.g. “Return to Dashboard” on complete).

---

### 2.6 Cards & surfaces

- Cards use `rounded-[1.5rem]` / `rounded-[1.75rem]`, `border section-divider`, `bg-background/55` (or similar).  
- Dashboard assessment cards, settings blocks, and profile blocks are visually consistent.  

**Verdict:** Cohesive card language across protected and auth areas.

---

### 2.7 Loading & empty states

- **Assessment hub:** Skeleton (pulse bars) while rehydrating.  
- **Intake interview:** “Loading interview…” with spinner.  
- **Assessment results:** “Calculating your personal risk profile results…” with spinner.  
- **Dashboard:** Empty state for “No assessments yet” with “Start Assessment” CTA.  

**Verdict:** Loading and empty states are present and understandable.

---

### 2.8 Nav (protected)

- Nav items: Dashboard, Intake, Advisor (if role), Assessment, Profiles, Settings.  
- “Signed in as {email}” in header (hidden on smaller breakpoints, shown at `lg`).  
- Sign Out in header.  

**Done:** Active nav item now uses `aria-current="page"` and distinct styling (`bg-secondary`, `font-semibold`) via the `ProtectedNav` client component; sub-routes (e.g. `/assessment/family-governance/0`) highlight the parent nav item.

---

## 3. Summary

| Category | Summary |
|----------|--------|
| **QA** | Flows work; timeouts and error handling in place for assessment and intake. Small improvements: success feedback on sign-in, clearer copy when rehydration fails or interview load fails, and optional aria-live for key status updates. |
| **UI** | Layout, typography, and spacing are consistent and appropriate for desktop. Main fix: **Intake complete page** should use design tokens instead of hardcoded blue/green so it matches the design system and supports theming. Optional: unify card title sizes and add active state to protected nav. |

---

## 4. Suggested next steps (priority)

1. **High:** Intake complete page — replace `green-*` / `blue-*` with theme tokens (e.g. success/info or primary/muted).  
2. **Medium (done):** Protected nav — active state and `aria-current="page"` implemented in `ProtectedNav` component.  
3. **Low:** Optional aria-live for “Saving…”, “Response saved”, and sign-in success; optional short copy when assessment rehydration fails or times out.
