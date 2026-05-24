# Epic 5.9 — Extended & Legacy Risk Modules

**Status:** **Legacy / reconcile** → stories US-45–US-47 proposed  
**Purpose:** Document parallel product surfaces that are **not** part of the canonical six-pillar Epic 5.2 path. Use this epic to decide **retire**, **merge**, or **promote** each module.

## Reconciliation decision matrix

| Module | Routes / entry | vs Epic 5.2 | Recommended action |
|--------|----------------|-------------|-------------------|
| **Identity risk (standalone)** | `/assessment/identity-risk/*` → redirects to `governance` | Superseded by six-pillar model | **Retire** client route; keep advisor analytics until merged |
| **Family-governance monolith** | `/assessment/family-governance/*` → redirects to `governance` | Legacy single-pillar with 6 subcategories in `questions.ts` | **Retire** redirects after migration window |
| **Enhanced assessment API** | `/api/assessment/enhanced/*` | Full engine without matching client UI for all flows | **Document** as admin/integration API or merge into canonical score path |
| **Cyber risk dashboard** | `/advisor/cyber-risk` | Overlaps `cyber-digital` pillar | **Merge** into portfolio dashboard or mark advisor-only supplement |
| **Identity risk dashboard** | `/advisor/identity-risk` | Not a BRD seventh pillar | **Merge or retire** |
| **Intelligence / portfolio risk** | `/advisor/intelligence` | Portfolio-wide analytics (v1.3 INTEL-*) | **Keep** — separate epic family (analytics), not assessment questionnaire |
| **Family self-service dashboard** | `/family/dashboard` | Client trends / household view (v1.3 FAMILY-*) | **Keep** — complement to `/dashboard` |
| **GPT recommendations** | `/api/cyber-risk/recommendations`, `/api/identity-risk/recommendations` | Parallel to US-18 rule engine | **Reconcile:** one recommendation source of truth per assessment |

---

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-45 | Advisor cyber risk view | **Legacy** | Separate from six-pillar client UI |
| US-46 | Advisor identity risk view | **Legacy** | Not in BRD pillar list |
| US-47 | Portfolio intelligence dashboard | **Code-only** | Cross-client risk intelligence |

---

## US-45 — Review Cyber Risk (Advisor)

| Capability | Implementation |
|------------|----------------|
| Cyber-specific advisor dashboard | `/advisor/cyber-risk` |
| Dedicated question catalog | `src/lib/cyber-risk/questions.ts` |
| AI-generated recommendations | `/api/cyber-risk/recommendations` |

**Reconciliation:** Client path for cyber is **`cyber-digital`** pillar (Epic 5.2). This module is a **parallel** surface.

---

## US-46 — Review Identity Risk (Advisor)

| Capability | Implementation |
|------------|----------------|
| Identity advisor dashboard | `/advisor/identity-risk` |
| Identity question catalog | `src/lib/identity-risk/questions.ts` |
| AI recommendations | `/api/identity-risk/recommendations` |

**Reconciliation:** `identity-risk` was removed from client hub; legacy URLs redirect to `governance`. Advisor UI still exists — **explicit retire or merge decision needed**.

---

## US-47 — Portfolio Risk Intelligence (Advisor)

| Capability | Implementation |
|------------|----------------|
| Portfolio risk list | `/advisor/intelligence` |
| Family drill-down | `/advisor/intelligence/[familyId]` |

**Code:** `src/lib/intelligence/queries.ts`, intelligence components

**Reconciliation:** Analytics over assigned clients; does not replace per-household Epic 5.2 assessment. Align with v1.3 INTEL requirements in `.planning/PROJECT.md`.

---

## Enhanced assessment API (integration note)

| Endpoint | Role |
|----------|------|
| `GET /api/assessment/enhanced/pillars` | List pillars from enhanced engine |
| `POST /api/assessment/enhanced/create` | Create enhanced assessment |
| `POST /api/assessment/enhanced/submit` | Submit answers |
| `GET /api/assessment/enhanced/[id]/results` | Results payload |

**Code:** `src/lib/assessment/engines/**`, enhanced routes

**Reconciliation:** Prefer Epic 5.2 client UI + `POST /api/assessment/[id]/score` for product behavior. Enhanced API suitable for scripts, admin tools, or future mobile clients — document or deprecate publicly.

---

## Playwright coverage

| Area | Status |
|------|--------|
| Intelligence / cyber / identity advisor pages | **Not implemented** |

## Related

- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — canonical six-pillar path
- [README](./README.md) — canonical vs parallel paths table
- [.planning/PROJECT.md](../../.planning/PROJECT.md) — v1.5 cyber risk intelligence milestone
