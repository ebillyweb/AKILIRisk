# Epic 5.5 — Platform Administration & Configuration

**Status:** **Done** (BRD US-37 – US-46)  
**Admin UI:** `/admin/*`  
**FR:** FR-10; business rules §3.1, §3.2

Repo history used internal IDs **US-29 – US-34** for the same capabilities; the BRD numbering below is authoritative for sign-off.

## Coverage summary

| BRD story | Title | Status | Playwright |
|-----------|--------|--------|------------|
| US-37 | Assessment question bank | **Done** | `epic-5.5-platform-admin.spec.ts` |
| US-38 | Intake interview script | **Done** | `admin-intake-script.spec.ts` |
| US-39 | Recommendation catalog | **Done** | `epic-5.5-platform-admin.spec.ts` |
| US-40 | Recommendation rules | **Done** | `epic-5.5-platform-admin.spec.ts` (form) + unit |
| US-41 | Risk-tier thresholds | **Done** | `epic-5.5-platform-admin.spec.ts` |
| US-42 | Platform feature flags | **Done** | `epic-5.5-platform-admin.spec.ts` |
| US-43 | Platform analytics | **Done** | `epic-5.5-platform-admin.spec.ts` |
| US-44 | Operations & integration health | **Done** | `epic-5.5-platform-admin.spec.ts` |
| US-45 | Advisor & client accounts | **Done** | `admin-advisors.spec.ts`, `epic-5.5-platform-admin.spec.ts` |
| US-46 | Platform staff accounts | **Done** | `epic-5.5-platform-admin.spec.ts` + unit |

### Extra capabilities (not in BRD US-37–46 excerpt)

| Capability | Route / code |
|------------|--------------|
| Rescore assessments | `/admin/assessment`, `admin-rescore-actions.ts` |
| Audit log UI + CSV | `/admin/audit-log` |
| GDPR / tenant exports | `/admin/exports` (super-admin) — see **US-64** below |
| Control center | `/admin` — Configuration quick-access cards for both question banks |

**BRD mapping:** Tenant export is **US-64** in some BRDs labeled “Epic 5.9”; in this repo it lives under **5.5**, not [Epic 5.9](./EPIC-5.9-extended-risk-modules.md). See [FR-6 reconciliation](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md).

---

## US-64 — Export a tenant data bundle (admin)

**As a** platform admin, **I want** to export a tenant-scoped data bundle, **so that** I can fulfill data requests without leaking other tenants' data.

| Acceptance criterion | Met | Implementation |
|---------------------|-----|----------------|
| Bundle strictly scoped to one tenant's client assignments | ✅ | `composeTenantZip` / `fetchTenantBundle` scoped by `ClientAdvisorAssignment` (`src/lib/export/queries.ts`) |
| Non-admin → not found (not forbidden) | ✅ | `GET /api/admin/exports` → **404** |
| Audit before stream; size cap | ✅ | `writeAudit` (`DATA_ACCESS_EXPORT`) before ZIP; `EXPORT_BYTE_CAP` (50 MB) |

**UI:** `/admin/exports`. **API:** `?scope=tenant&advisorProfileId=...` or `scope=system`.

**Playwright:** **Not implemented** (unit coverage in `src/lib/export/bundle.test.ts`, `queries.test.ts`).

**Not the same as:** Per-pillar policy download — [Epic 5.8](./EPIC-5.8-policy-templates-deliverables.md).

---

## US-37 — Administer the Assessment Question Bank

**Single source:** Belvedere pillar DDL (`questions` table / `PillarQuestion`). Legacy `AssessmentBankQuestion` removed (migration `20260523140000`). BRD **US-65** legacy-table fallback is **not** implemented — see [FR-6 reconciliation](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md).

| Acceptance criterion | Met | Implementation |
|---------------------|-----|----------------|
| Create / edit / delete → new assessments | ✅ | `createPillarQuestion`, `updatePillarQuestionContent`, `deletePillarQuestion` |
| Hide → excluded from new assessments and scoring | ✅ | `updatePillarQuestionVisibility`; `load-bank.ts` + `pillar-config.ts` with `onlyVisible: true`; admin rescore uses the same filter |
| Reorder | ✅ | `movePillarQuestionOrder`, `pillar-question-reorder.ts` (up/down within risk-area list; disabled while type filter is active) |
| Audit log | ✅ | `pillar_question.create`, `.update`, `.delete`, `.visibility_toggle`, `.reorder` — entity history at `/admin/audit-log/entity/PillarQuestion/{id}` |

**Scope notes (sign-off):**

- Bank is partitioned by **risk area** (governance, cyber-digital, physical-security, …), not a single global list.
- Changes apply when the bank is **loaded for scoring** (new assessments and admin rescore). In-progress assessments may retain answers to questions later hidden or deleted.
- Section ids in seed DDL use non–RFC UUIDs; actions validate ids via `pillarDbUuidSchema` (not strict `z.string().uuid()`).
- Mutating actions redirect with `?saved=1` so the list/edit UI reflects changes without a manual refresh.

**Routes:** `/admin/assessment/questions`, `/admin/assessment/questions/[riskAreaId]`, `/admin/assessment/questions/[riskAreaId]/new`, `/admin/assessment/questions/[riskAreaId]/[questionId]` (legacy `/admin/question-bank/*` redirects)

**Nav:** Configuration section in admin sidebar — Intake question bank, Assessment question bank, Recommendations, Risk-tier thresholds

**Seed:** `npm run seed:pillar-ddl`

**Code:** `src/lib/actions/admin-question-bank-actions.ts`, `src/lib/assessment/bank/**`

**Tests:** `epic-5.5-platform-admin.spec.ts` (CRUD, visibility, reorder, audit row); `admin-question-bank-actions.test.ts` (unit); `pillar-db-uuid.test.ts`

---

## US-38 — Administer the Intake Interview Script

| Acceptance criterion | Met | Implementation |
|---------------------|-----|----------------|
| Edit content → new intakes | ✅ | `updateIntakePillarQuestionContent` |
| Hide → not presented | ✅ | `setIntakePillarQuestionVisibility` |
| Audit log | ✅ | `INTAKE_QUESTION_*` |

**Routes:** `/admin/intake/questions`, `/admin/intake/questions/[questionId]/edit`

**UI:** Shared `AdminPageHeader` — kicker “Configuration”, title “Intake question bank” (user-facing subtitle; no pillar/DB jargon on the page chrome)

**Code:** `src/lib/actions/admin-intake-questions-actions.ts`

---

## US-39 — Manage the Recommendation Catalog

| Acceptance criterion | Met | Implementation |
|---------------------|-----|----------------|
| CRUD name / description / category / priority / active | ✅ | `admin-recommendation-actions.ts` |
| Deactivate → not surfaced | ✅ | `setServiceRecommendationActive` |
| Block delete when referenced | ✅ | FK check → `FK_REFS_BLOCK_DELETE` |

**Routes:** `/admin/recommendations`, `/admin/recommendations/services/*`

**Out of scope (see [Epic 5.2 US-17b](./EPIC-5.2-household-assessment-lifecycle.md)):** Pillar summary paragraphs (all-no / all-yes / mid-band by risk tier) are **not** catalog rows. They are versioned in `src/lib/assessment/pillar-outcome-expectations*.ts` and require a code release to change unless a future admin CMS is added.

---

## US-40 — Manage Recommendation Rules

| Acceptance criterion | Met | Notes |
|---------------------|-----|-------|
| Trigger conditions, pillar thresholds, question conditions | ✅ | Rule form + schemas |
| Priority / active / deactivate | ✅ | |
| Contradiction detection | ⚠️ Partial | Impossible `score_threshold` pairs on same pillar only |

**Routes:** `/admin/recommendations/rules/*`

**Functional-spec note:** Rules drive **catalog service** recommendations (US-18), not pillar summary copy. Condition types: `score_threshold`, `risk_level`, `answer_match`, `missing_control`, `profile_condition`; a rule matches when **&gt;50%** of weighted conditions are satisfied (`RecommendationEngine`).

---

## US-41 — Configure Risk-Tier Thresholds (Super-Admin)

| Acceptance criterion | Met | Notes |
|---------------------|-----|-------|
| Non–super-admin blocked | ✅ | `requireSuperAdminRole()` |
| 0–100, strictly decreasing | ✅ | Zod + form |
| New scores only; stored tiers unchanged until re-score | ⚠️ | Admin **rescore** recomputes tiers with current thresholds (by design). Re-score also refreshes which **mid-band pillar narrative** applies (tier from thresholds; copy in code — Epic 5.2 US-17b). |

**Route:** `/admin/scoring/thresholds`

---

## US-42 — Manage Platform Feature Flags (Super-Admin)

| Acceptance criterion | Met |
|---------------------|-----|
| Toggle governance dashboard & risk intelligence | ✅ |
| Non–super-admin blocked | ✅ |
| Missing settings → defaults enabled | ✅ |

**Route:** `/admin/settings`

---

## US-43 — Monitor Platform Analytics (Admin)

| Acceptance criterion | Met |
|---------------------|-----|
| Aggregate platform metrics | ✅ |
| Audit without per-client identifiers | ✅ `DATA_ACCESS_ANALYTICS_VIEW` |

**Route:** `/admin/analytics`

---

## US-44 — Monitor Operations & Integration Health (Admin)

| Acceptance criterion | Met |
|---------------------|-----|
| Payments / AI / email / storage status | ✅ |
| Bounded probes, no secrets | ✅ |
| Recent failures surfaced | ✅ |

**Route:** `/admin/operations` — visible to all admins in sidebar (BRD § Admin, not super-admin-only).

---

## US-45 — Manage Advisor & Client Accounts (Admin)

| Acceptance criterion | Met |
|---------------------|-----|
| Soft-delete with timestamp | ✅ |
| Restore | ✅ |
| Advisor portal toggle | ✅ |
| Audit log | ✅ |

**Routes:** `/admin/advisors`, `/admin/clients`

---

## US-46 — Manage Platform Staff Accounts (Super-Admin)

| Acceptance criterion | Met |
|---------------------|-----|
| Promote client → admin staff | ✅ |
| Change / remove role | ✅ |
| Non–super-admin blocked | ✅ |

**Routes:** `/admin/staff`, `/admin/staff/admin-users`

---

## Playwright coverage

**Test fixtures:** `platform-admin@test.com` / `testpassword123` — `platformAdmin` in `tests/fixtures/users.ts` (role `ADMIN`, not `SUPER_ADMIN`); seeded by `scripts/seed-advisor-test-data.js`. Super-admin gates use `buddy@ebilly.com` (`admin` fixture). See CLAUDE.md.

| Spec | Stories |
|------|---------|
| `epic-5.5-platform-admin.spec.ts` | US-37 (CRUD + audit + index header + legacy redirects), US-39–US-44, US-45 (partial), US-46 (list), Control Center IA, ADMIN vs SUPER_ADMIN gates |
| `admin-intake-script.spec.ts` | US-38 |
| `admin-advisors.spec.ts` | US-45 (advisors list) |
| `audit-log-*.spec.ts` | US-45 audit + platform audit infrastructure |
| `admin-user-provisioning.test.ts` (unit) | US-46 provisioning actions |
| `admin-question-bank-actions.test.ts` (unit) | US-37 server actions + audit wiring |
| `admin-recommendation-actions.test.ts` (unit) | US-39–US-40 server actions |

## Related

- [FR-6 reconciliation](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md) — US-64 vs BRD “Epic 5.9”; US-65/66
- [Epic 5.8](./EPIC-5.8-policy-templates-deliverables.md) — policy Word/PDF (not tenant export)
- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — scoring, control gaps, pillar narratives (US-17b), catalog services (US-18), reports
- [ACCESS-LEVELS-BY-ROLE.md](../ACCESS-LEVELS-BY-ROLE.md)

## Suggested Functional Spec amendments (§5.5)

The BRD stories **US-37–US-46** in §5.5 remain accurate for admin configuration. Add a **cross-reference** (not a new admin story) in §5.2 or §3.2:

- **Pillar summary narratives** — tier-based paragraphs on results and PDF; not editable via US-39/40.
- **Per-question remediation** — editable via US-37 question fields where exposed in admin UI.
- **Catalog services** — US-39/40 as written.
