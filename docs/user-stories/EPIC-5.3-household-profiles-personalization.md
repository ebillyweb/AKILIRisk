# Epic 5.3 — Household Profiles & Personalization

**Index:** [User stories README](./README.md)  
**Status:** Stories **US-21 – US-23** document shipped behavior; **US-48 – US-49** capture new privacy/control requirements before implementation.  
**Why separate from Epic 5.2:** US-13 covers answer-based branching but not household member management, name/role personalization, or privacy controls.

## Design decisions (locked)

| Decision | Choice |
|----------|--------|
| Client household privacy (US-48) | Per-member `HouseholdMember.shareWithAdvisor` boolean |
| Advisor profile feature (US-49) | Tenant-wide toggle on `AdvisorProfile` only — no per-client override |
| Client ↔ advisor cardinality | **One client, one advisor** — advisors do not share clients; no multi-advisor edge cases |

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-21 | Manage household members | **Code-only** | CRUD at `/profiles`; promote to BRD |
| US-22 | Personalize assessment copy | **Code-only** | Names/roles in question text |
| US-23 | Profile-aware branching | **Partial** | Branching + `evaluateProfileCondition`; no Playwright E2E |
| US-48 | Control household information visibility | **Done** | `shareWithAdvisor` on `HouseholdMember` + advisor read-path filtering |
| US-49 | Disable household profiles (advisor) | **Done** | `AdvisorProfile.householdProfilesEnabled` + client/advisor gating |

---

## US-21 — Manage Household Members (Client)

**As a** client, **I want** to add and edit household members with governance roles, **so that** my assessment reflects who is in my family.

**Status: Code-only**

### Acceptance criteria

- Client can open `/profiles` from main navigation.
- Client can **list** all household members as cards showing relationship, residency, governance roles, and server-assigned `displayLabel` (e.g. “Member A”).
- Client can **add** a member with: birth year (optional), sex (optional), family relationship, governance roles, and resident vs extended-family flag.
- Client can **edit** an existing member’s demographic and role fields; `displayLabel` remains server-managed and is not user-editable.
- Client can **delete** a member with confirmation.
- All CRUD operations are scoped to the signed-in client; other users cannot read or mutate the household.
- Validation rejects invalid relationships, roles, or birth years.

### Implementation (today)

| Capability | Location |
|------------|----------|
| List / add / edit / remove | `/profiles`, `ProfilesClient.tsx` |
| Server actions | `src/lib/actions/profile-actions.ts` |
| Data layer | `src/lib/data/household-members.ts` |
| Model | `HouseholdMember` — `displayLabel`, `birthYear`, `sex`, `relationship`, `governanceRoles[]`, `isResident` |
| Optional encrypted PII | `fullName`, `phone`, `notes` (gated by consent — see US-48) |

**Reconciliation:** Promoted to BRD §3.5 FR-HH-01 ([amendment](../../.planning/brd-amendments/section-3-5-household-profiles.md)). Phase 5 verification passed (`.planning/phases/05-profile-foundation/05-VERIFICATION.md`).

---

## US-22 — See Personalized Assessment Questions (Client)

**As a** client, **I want** questions to reference my household by name and role, **so that** the assessment feels relevant.

**Status: Code-only**

### Acceptance criteria

- When a household profile exists, questions with a `textTemplate` render personalized copy (e.g. successor or decision-maker by role).
- When no profile exists, or a template has no matching role, the question falls back to generic static text.
- Personalization uses the client-visible label (`displayLabel`, or `fullName` when consented and visible — see US-48).
- Personalization does not change scoring weights or maturity options.
- Assessment without any household members behaves identically to a profile-disabled experience (backward compatible).

### Implementation (today)

| Capability | Location |
|------------|----------|
| Text substitution | `getPersonalizedText()` in `src/lib/assessment/personalization.ts` |
| Bank wiring | `textTemplateForQuestionId()` in `src/lib/assessment/bank/behaviors.ts` (currently `dma-05`, `sp-02`) |
| UI | `useHouseholdProfile` → question page → `QuestionCard` |
| Tests | `src/lib/assessment/personalization.test.ts` (15 tests) |

**Gap:** Limited template coverage in the pillar bank; expand or document intentional MVP scope at implementation time.

---

## US-23 — Branch Assessment by Household Profile (System)

**As the** platform, **I want** to show or hide questions based on household composition, **so that** clients only answer applicable items.

**Status: Partial (overlaps Epic 5.2 / US-13)**

### Acceptance criteria

- **Answer-based branching** (US-13): follow-up questions show/hide based on prior answers; unchanged when profile is absent.
- **Profile-based branching**: questions with a `profileCondition` are hidden when the condition evaluates false against the client’s household profile.
- **Profile-based branching**: when profile is null or household profiles are disabled for the client (US-49), profile conditions evaluate as “not met” and those questions stay hidden.
- **Recommendation rules**: `evaluateProfileCondition` can gate service recommendations on household composition (Epic 5.2 / US-18).
- Admin question bank supports profile condition keys: `young-dependent`, `trustee-in-family`, `generations-or-successors`.
- Skipped/hidden questions are excluded from scoring (same as US-13 / US-15).

### Implementation (today)

| Capability | Location |
|------------|----------|
| Answer branching | `src/lib/assessment/branching.ts` |
| Profile conditions on questions | `profileCondition` on `Question`; admin picklist in `AssessmentBankQuestionFields.tsx` |
| Recommendation profile gates | `src/lib/assessment/profile-condition.ts` |
| Tests | `branching.test.ts`, `profile-condition.test.ts` |

**Gap:** No Playwright E2E for profile-driven question visibility.

**Reconciliation with US-13:** US-13 AC = answer-based follow-ups; US-23 AC = profile-based filters. Cross-link in BRD §3.2 addendum + §3.5 FR-HH-02 ([amendment](../../.planning/brd-amendments/section-3-5-household-profiles.md)).

---

## US-48 — Control Household Information Visibility (Client)

**As a** client, **I want** to choose which aspects of my household information my advisor can see, **so that** I can participate in the assessment while protecting sensitive details.

**Status: Gap** (partial foundation in Epic 5.6 / Option D PII policy)

### Background — what already exists

| Mechanism | Purpose | Location |
|-----------|---------|----------|
| Pseudonymous labels | Server assigns `displayLabel` (“Member A”) so names are not required | `household-members.ts` |
| Advisor PII policy | Advisor toggles which **optional** fields future clients may be offered | `AdvisorProfile.piiPolicy`, `/advisor/settings/pii-policy` |
| Per-assignment consent | Client Yes/No on intake consent modal; snapshotted to `ClientAdvisorAssignment.fieldVisibility` | `/consent/pending`, `consent-decision-actions.ts` |
| Eligible optional fields | `User.name`, `ClientProfile.phone`, `HouseholdMember.fullName`, `HouseholdMember.phone`, `HouseholdMember.notes` | `src/lib/advisor/pii-policy.ts` |
| Settings-side opt-in | Client can grant visibility when filling a gated field | `recordPiiFieldConsent` (Epic 5.6) |

### Acceptance criteria

#### A. Consent surfaces (optional PII)

- Before or during onboarding, client sees a clear consent step for **each optional PII field** the advisor’s policy allows (existing `/consent/pending` flow).
- Client can revisit consent from **Settings** and change prior Yes/No decisions; changes are audited.
- Consent UI explains what the advisor sees vs what stays client-only (e.g. “Member A” vs legal name).

#### B. Per-member sharing (`shareWithAdvisor`)

- Each `HouseholdMember` has a **`shareWithAdvisor`** boolean (default **true** on create; backfill existing rows to **true**).
- Client toggles sharing **per member** on `/profiles` (add/edit form and/or member card).
- When `shareWithAdvisor` is **false** for a member:
  - Advisor pipeline, review UI, PDF snapshot, and exports **omit** that member entirely (or show an aggregate count only — exact advisor copy TBD).
  - Optional PII on that row (`fullName`, `phone`, `notes`) is never shown to the advisor regardless of consent flags.
  - Client assessment **still uses** that member locally for personalization (US-22) and profile branching (US-23).
- When `shareWithAdvisor` is **true**, the member’s structured fields (relationship, roles, birth year, sex, residency, `displayLabel`) are visible to the assigned advisor; optional PII fields remain gated by existing consent (`fieldVisibility` / Epic 5.6).

#### C. Optional PII (unchanged path)

- Consent for `User.name`, `ClientProfile.phone`, and per-member `fullName` / `phone` / `notes` continues via `/consent/pending` and Settings (Epic 5.6).
- Client can answer **No** without blocking assessment access.
- When client declines optional PII, advisor sees `displayLabel` only for shared members.

#### D. Audit & compliance

- Every `shareWithAdvisor` change and consent change emits audit rows.
- Export bundle (BRD §5.3 portability) respects the same visibility rules as advisor-facing surfaces.

### Out of scope (this story)

- Platform-wide encryption changes (Epic 5.6 / US-37).
- Advisor ability to disable household profiles entirely (US-49).

### Implementation notes (for later)

- Add `HouseholdMember.shareWithAdvisor Boolean @default(true)` + migration backfill.
- Wire read-side filtering in: advisor pipeline client detail, report snapshot builder, export serializers, template data mapper.
- Playwright: member with `shareWithAdvisor=false` → absent from advisor view; client assessment still personalized.

### Related

- [Epic 5.6 — US-36, US-37](./EPIC-5.6-account-security-compliance.md)
- BRD §3.5 FR-HH-03 ([amendment](../../.planning/brd-amendments/section-3-5-household-profiles.md))
- BRD §5.1 addendum ([round 13](../../.planning/brd-amendments/round-13-shareWithAdvisor-behavior.md))

---

## US-49 — Disable Household Profiles for Clients (Advisor)

**As an** advisor, **I want** to turn off household profiles for my clients, **so that** my practice can run assessments without collecting or displaying household composition data.

**Status: Gap** (no `householdProfilesEnabled` or equivalent today)

### Acceptance criteria

#### A. Advisor configuration

- Advisor can toggle **“Household profiles”** in advisor settings, similar in UX to existing PII policy and branding toggles.
- Default for new advisors: **enabled** (preserves current product behavior).
- Toggle persists on **`AdvisorProfile.householdProfilesEnabled`** (tenant-wide; applies to all of that advisor’s clients).
- Change is audited (`HOUSEHOLD_PROFILES_POLICY_UPDATE` or reuse platform audit pattern).
- **No per-client override** — when off, it is off for every client under that advisor.

#### B. Client experience when disabled

- `/profiles` navigation link is **hidden**; direct navigation shows an explanatory empty state or redirects (not a hard error).
- Intake completion nudge to add household members is **suppressed** (`/intake/complete`).
- Assessment uses **generic question text only** (US-22 templates skipped).
- **Profile-based branching** (US-23) treats all profile conditions as false; only answer-based branching (US-13) applies.
- Scoring and completion rules unchanged (US-15).

#### C. Advisor experience when disabled

- Advisor pipeline and client detail **do not show** household composition sections.
- Report draft/publish and PDF generation **omit** household member tables and governance-by-name sections (same as clients with no profiles today).
- Policy template generation omits household member placeholders.

#### D. Existing data

- Disabling does **not delete** existing `HouseholdMember` rows; client data is retained but inactive while disabled.
- Re-enabling restores `/profiles` access and personalization for that advisor’s clients going forward.

### Implementation notes (for later)

- Add `AdvisorProfile.householdProfilesEnabled Boolean @default(true)`.
- Central helper e.g. `isHouseholdProfilesEnabled(advisorProfileId)` consumed by nav, assessment loader, report builder, and hooks (resolve advisor via the client’s single assignment).
- Playwright: advisor disables → client nav hides profiles → assessment shows generic succession question.

### Related

- BRD §3.5 FR-HH-04 ([amendment](../../.planning/brd-amendments/section-3-5-household-profiles.md))
- [Epic 5.4 — US-28](./EPIC-5.4-advisor-workspace-pipeline.md) (client pipeline / detail surfaces)
- [Epic 5.8 — US-43](./EPIC-5.8-policy-templates-deliverables.md) (template placeholders)

---

## Playwright coverage

| Area | Status |
|------|--------|
| Household CRUD (US-21) | **Implemented** — `tests/smoke/epic-5.3-household-profiles.spec.ts` |
| Personalized question text (US-22) | **Not implemented** |
| Profile branching (US-23) | **Not implemented** |
| Consent / visibility (US-48) | **Implemented** — advisor review omits hidden members |
| Advisor disable profiles (US-49) | **Implemented** — nav hidden + disabled notice |

## Related

- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — US-13, US-15, US-18
- [Epic 5.6](./EPIC-5.6-account-security-compliance.md) — consent & encryption
- [.planning/PROJECT.md](../../.planning/PROJECT.md) — v1.1 household profile milestone
- [.planning/milestones/v1.1-MILESTONE-AUDIT.md](../../.planning/milestones/v1.1-MILESTONE-AUDIT.md) — phases 5–7 passed
