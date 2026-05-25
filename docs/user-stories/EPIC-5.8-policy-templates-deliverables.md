# Epic 5.8 — Policy Templates & Extended Deliverables

**Status:** **Partial** — core paths shipped; BRD US-62–US-63 aligned in code  
**FR:** FR-6 (policy documents only; tenant export is [US-64 in Epic 5.5](./EPIC-5.5-platform-administration.md))  
**Why separate from Epic 5.2:** US-19–US-20 cover the **PDF risk report** only, not per-pillar policy Word/PDF.

**BRD numbering:** If your BRD uses “Epic 5.9” for tenant exports, see [FR-6 reconciliation](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md).

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-43 | Download policy template (client) | **Done** | Word + PDF via `format=docx\|pdf` |
| US-44 | Bulk download all templates | **Done** | `TemplateList` “All Word” / “All PDF” |
| US-62 | Generate per-pillar policy documents (advisor) | **Done** | Six pillars; assignment-gated API |
| US-63 | Co-branded policy documents (advisor) | **Done** | When `brandingEnabled` + entitlements |

---

## US-62 — Generate per-pillar policy documents (advisor)

**As an** advisor, **I want** a policy document for each risk pillar from a scored assessment, **so that** I can give clients actionable written policies.

| Acceptance criterion | Met | Implementation |
|---------------------|-----|----------------|
| Scored assessment → Word doc per pillar (Governance, Cyber/Digital, Physical, Insurance, Geographic/Environmental, Reputational/Social) | ✅ | `TEMPLATE_REGISTRY`; `buildPolicyDocument`; `GET /api/templates/[id]?template={pillarId}` |
| Document includes scores, gaps, strengths, recommendations; anonymized member labels | ✅ | `mapAssessmentToTemplate` uses `displayLabel` only; advisor view uses `getHouseholdProfileForAdvisorView` |
| Assessment not owned / not assigned → not found | ✅ | `resolvePolicyDocumentAccess` → **404** (owner, active-assigned advisor, or admin only) |

**Pillar scores:** `loadPillarScoreForTemplate` resolves canonical + legacy DB slugs (see [US-66](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md)).

**UI:** Advisor client pipeline → **Policy documents** card (`ClientDetailView` + `TemplateList` `variant="advisor"`).  
**Client UI:** Assessment results → `TemplateList` (default client variant).

---

## US-63 — Produce co-branded policy documents (advisor)

**As an** advisor, **I want** policy documents that carry my firm branding, **so that** deliverables match my brand.

| Acceptance criterion | Met | Implementation |
|---------------------|-----|----------------|
| Branding configured → firm name, tagline, website, support contact, confidentiality, generation date | ✅ Word | `generateBrandedTemplate` + `*-enhanced.docx` |
| Same branding fields on PDF when advisor downloads | ✅ PDF | `renderPolicyDocumentPdf` + `PolicyDocument.tsx` when `getAdvisorBrandingForPDF` returns data |
| Household data uses anonymized labels, not names | ✅ | Same mapper as US-62 |

**Code:** `src/lib/templates/enhanced-generator.ts`, `src/lib/pdf/render-policy-document.tsx`, `src/lib/pdf/components/PolicyDocument.tsx`

---

## US-43 / US-44 — Client policy templates (internal IDs)

Same API and `TemplateList` as US-62; client auth is assessment **owner**. Co-branding applies when an advisor with branding downloads (US-63); clients receive standard templates unless branding is resolved for their assigned advisor.

| Capability | Implementation |
|------------|----------------|
| Template registry (six pillars) | `src/lib/templates/types.ts`, `TEMPLATE_REGISTRY` |
| Word generation | `generator.ts`, `templates/{pillarId}.docx` |
| PDF generation | `?format=pdf` |
| Bulk download | `TemplateList` sequential download |

**Reconciliation:** Requires pillar score for the selected template; **not** gated on published PDF report.

---

## API

```
GET /api/templates/{assessmentId}?template={pillarId}&format=docx|pdf
GET /api/templates/{assessmentId}?all=true   # JSON registry
```

**On-disk templates:** Run once after clone or template text changes:

```bash
npx tsx src/lib/templates/create-templates.ts
npx tsx src/lib/templates/enhanced-templates.ts
```

---

## Playwright coverage

| Area | Status |
|------|--------|
| Advisor Word + PDF + UI download | **Implemented** — `tests/smoke/epic-5.8-advisor-policy-templates.spec.ts` |
| Unassigned advisor 404 | **Implemented** — same spec (`advisor2`) |
| Client template download | **Not implemented** |

---

## Related

- [FR-6 reconciliation](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md) — US-64 export, US-65/66 continuity
- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — gaps feed template content
- [Epic 5.3](./EPIC-5.3-household-profiles-personalization.md) — `displayLabel` in templates
- [Epic 5.5](./EPIC-5.5-platform-administration.md) — US-64 tenant ZIP export
- [Epic 5.9](./EPIC-5.9-extended-risk-modules.md) — legacy advisor modules (not policy export)
- [.planning/phases/04-reports-templates/](../../.planning/phases/04-reports-templates/) — original template phase
