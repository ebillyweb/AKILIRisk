# Epic 5.3 — Household Profiles & Personalization

**Status:** **Code-only** → stories US-21–US-23 proposed below  
**Why separate from Epic 5.2:** US-13 mentions branching and hidden questions but not household member management or name/role personalization.

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-21 | Manage household members | **Code-only** | CRUD at `/profiles` |
| US-22 | Personalize assessment copy | **Code-only** | Names/roles in question text |
| US-23 | Profile-aware branching | **Partial** | Branching + `evaluateProfileCondition` for rules; intake personalization separate |

---

## US-21 — Manage Household Members (Client)

**As a** client, **I want** to add and edit household members with governance roles, **so that** my assessment reflects who is in my family.

**Status: Code-only**

| Capability | Implementation |
|------------|----------------|
| List / add / edit / remove members | `/profiles`, household member actions |
| Fields: display label, birth year, sex, relationship, roles, residency | `HouseholdMember` model |
| Extended (non-resident) members | `isResident` flag |

**Code:** `src/app/(protected)/profiles/page.tsx`, `src/lib/actions/household-actions.ts`, `src/lib/assessment/personalization.ts`

**Reconciliation:** Promote to BRD as FR extension or §3.x household profile rules.

---

## US-22 — See Personalized Assessment Questions (Client)

**As a** client, **I want** questions to reference my household by name and role, **so that** the assessment feels relevant.

**Status: Code-only**

| Capability | Implementation |
|------------|----------------|
| Placeholder substitution in question text | `personalization.ts`, question rendering |
| Backward compatible when no profile | Empty household placeholders |

**Code:** `src/lib/assessment/personalization.ts`, assessment question components

---

## US-23 — Branch Assessment by Household Profile (System)

**As the** platform, **I want** to show or hide questions based on household composition, **so that** clients only answer applicable items.

**Status: Partial (overlaps US-13)**

| Capability | Implementation |
|------------|----------------|
| Answer-based branching | `branching.ts` (Epic 5.2 / US-13) |
| Profile-field conditions on questions | Profile operators in branching |
| Profile conditions on recommendation rules | `evaluateProfileCondition` (Epic 5.2 / US-18) |

**Gap:** No dedicated E2E for profile-driven question visibility.

**Reconciliation with US-13:** US-13 AC covers answer-based follow-ups; US-23 covers profile-based filters — consider merging in BRD or cross-linking.

---

## Playwright coverage

| Area | Status |
|------|--------|
| Household CRUD | **Not implemented** |
| Personalized question text | **Not implemented** |
| Profile branching | **Not implemented** |

## Related

- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — US-13, US-18
- [.planning/PROJECT.md](../../.planning/PROJECT.md) — v1.1 household profile milestone
