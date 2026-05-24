# Epic 5.5 — Platform Administration & Configuration

**Status:** **Code-only** → stories US-29–US-34 proposed  
**Admin UI:** `/admin/*`  
**Why separate:** Epic 5.2 assumes rules, thresholds, and question bank exist; admin UX is not specified in US-10–US-20.

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-29 | Manage assessment question bank | **Code-only** | CRUD, visibility, pillar DDL |
| US-30 | Manage intake script | **Code-only** | Admin intake questions |
| US-31 | Configure recommendation rules & services | **Code-only** | Rules + services CRUD |
| US-32 | Configure risk thresholds | **Code-only** | `/admin/scoring/thresholds` |
| US-33 | Rescore assessments | **Code-only** | Admin rescore actions |
| US-34 | Audit, export & operations | **Code-only** | Audit log, CSV export, health |

---

## US-29 — Manage Assessment Question Bank (Admin)

| Capability | Implementation |
|------------|----------------|
| List pillars / risk areas | `/admin/question-bank` |
| Edit questions, visibility | `/admin/question-bank/[riskAreaId]/[questionId]` |
| Pillar DDL seed path | `npm run seed:pillar-ddl`, Belvedere workbook import |

**Code:** `src/app/(protected)/admin/question-bank/**`, `src/lib/assessment/bank/**`

**Reconciliation:** Client assessment reads bank via `pillar-config.ts` (Epic 5.2). Admin edits are the source of truth for US-13 hidden questions.

---

## US-30 — Manage Intake Script (Admin)

| Capability | Implementation |
|------------|----------------|
| Edit intake questions | `/admin/intake/questions` |
| Hide/show intake items | Intake question admin |

**Code:** `src/app/(protected)/admin/intake/**`

---

## US-31 — Manage Recommendation Rules & Services (Admin)

| Capability | Implementation |
|------------|----------------|
| Services CRUD | `/admin/recommendations/services/*` |
| Rules CRUD | `/admin/recommendations/rules/*` |

**Code:** `src/app/(protected)/admin/recommendations/**`

**Reconciliation:** US-18 consumes these records at score time; no client-facing admin in Epic 5.2.

---

## US-32 — Configure Risk Thresholds (Admin)

| Capability | Implementation |
|------------|----------------|
| Edit Low/Medium/High/Critical cutoffs | `/admin/scoring/thresholds` |

**Reconciliation with US-16:** Stored tiers on existing scores unchanged until rescore (US-33).

---

## US-33 — Rescore Assessments (Admin)

| Capability | Implementation |
|------------|----------------|
| Bulk or single rescore after rule/threshold fixes | `admin-rescore-actions.ts` |
| Optional republish report with new numbers | Report republish flow |

**Code:** `src/lib/actions/admin-rescore-actions.ts`

---

## US-34 — Audit, Export & Operations (Admin)

| Capability | Implementation |
|------------|----------------|
| Audit log search + entity drill-down | `/admin/audit-log` |
| GDPR / data exports | `/admin/exports` |
| Operations health (Stripe, webhooks, etc.) | `/admin/operations` |
| Integrations | `/admin/integrations` |
| Staff, advisors, clients, leads | `/admin/staff`, `/admin/advisors`, `/admin/clients`, `/admin/leads` |
| Platform settings / feature flags | `/admin/settings` |

**Code:** `src/lib/audit/**`, `src/lib/admin/**`, `src/lib/export/**`

---

## Playwright coverage

| Area | Status |
|------|--------|
| Admin advisors list | `admin-advisors.spec.ts` |
| Question bank / rescore / audit | **Not implemented** |

## Related

- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — US-16, US-18
- [ACCESS-LEVELS-BY-ROLE.md](../ACCESS-LEVELS-BY-ROLE.md)
