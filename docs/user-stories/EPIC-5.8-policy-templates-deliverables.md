# Epic 5.8 — Policy Templates & Extended Deliverables

**Status:** **Code-only** → stories US-43–US-44 proposed  
**Why separate from Epic 5.2:** US-19–US-20 cover the **PDF risk report** only, not Word policy generation.

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-43 | Download governance policy templates | **Code-only** | `.docx` from scored pillar |
| US-44 | Bulk download all templates | **Code-only** | `TemplateList` “download all” |

---

## US-43 — Download a Policy Template (Client / Advisor)

**As a** client with a scored assessment, **I want** to download a Word policy template pre-filled with my gaps and recommendations, **so that** I can implement governance documents.

| Capability | Implementation |
|------------|----------------|
| Template registry (six pillar-aligned policies + legacy set) | `src/lib/templates/types.ts`, `TEMPLATE_REGISTRY` |
| Generate from assessment + household profile | `mapAssessmentToTemplate`, `/api/templates/[id]` |
| Enhanced branding variables when advisor branded | `enhanced-templates.ts`, `enhanced-generator.ts` |

**Code:** `src/components/reports/TemplateList.tsx`, `src/lib/templates/generator.ts`  
**UI:** Shown on assessment results / report adjacent surfaces

**Reconciliation:** Templates require pillar score for the selected template’s risk area; not gated on published PDF report.

---

## US-44 — Download All Policy Templates (Client)

| Capability | Implementation |
|------------|----------------|
| Bulk ZIP or sequential download | `TemplateList` bulk action |

---

## Playwright coverage

| Area | Status |
|------|--------|
| Template download | **Not implemented** |

## Related

- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — US-17 gaps feed template content
- [Epic 5.3](./EPIC-5.3-household-profiles-personalization.md) — household placeholders in templates
- [.planning/phases/04-reports-templates/](../../.planning/phases/04-reports-templates/) — original template phase
