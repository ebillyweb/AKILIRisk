# Epic 5.4 — Advisor Workspace, Pipeline & Documents

**Status:** **Code-only** → stories US-24–US-28 proposed  
**BRD alignment:** v1.4 STATUS-*, DOC-*, NOTIFY-* (see `.planning/milestones/v1.4-ROADMAP.md`)  
**Advisor UI:** `/advisor`, `/advisor/pipeline`, `/advisor/dashboard`, `/documents` (client)

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-24 | View client pipeline | **Code-only** | Stages, filters, SSE refresh |
| US-25 | Drill into client workflow | **Code-only** | Timeline, document status |
| US-26 | Request client documents | **Code-only** | `DocumentRequirement` CRUD |
| US-27 | Upload requested documents | **Code-only** | Client portal + S3 presigned |
| US-28 | Advisor workspace priorities | **Code-only** | Hub priorities + notifications |

---

## US-24 — View Client Pipeline (Advisor)

**Status: Code-only**

| Capability | Implementation |
|------------|----------------|
| Pipeline table with workflow stages | `/advisor/pipeline`, `getClientPipeline` |
| Stage computed from invite/intake/assessment state | `src/lib/pipeline/status.ts` |
| Real-time updates | `/api/advisor/status-stream`, pipeline hooks |
| Filter / sort / stalled detection | Pipeline metrics + table UI |

**Code:** `src/lib/pipeline/queries.ts`, `src/app/(protected)/advisor/pipeline/page.tsx`

---

## US-25 — Review Client Workflow Detail (Advisor)

**Status: Code-only**

| Capability | Implementation |
|------------|----------------|
| Client detail drill-down | `/advisor/pipeline/[clientId]` |
| Intake waiver display | `intakeWaivedAt` on assignment |
| Report list / edit entry | `/advisor/pipeline/[clientId]/report` |

**Code:** `src/components/pipeline/ClientDetailView.tsx`

**Reconciliation with Epic 5.2:** Report draft/publish (US-19–20) is reached from pipeline, not only from a standalone “review” nav item.

---

## US-26 — Mark Required Documents (Advisor)

**Status: Code-only**

| Capability | Implementation |
|------------|----------------|
| Add/remove document requirements | `addDocumentRequirement`, `removeDocumentRequirement` |
| Per-client tracking | `DocumentRequirement` model |

**Code:** `src/lib/actions/pipeline-actions.ts`

---

## US-27 — Upload Documents (Client)

**Status: Code-only**

| Capability | Implementation |
|------------|----------------|
| View advisor requests | `/documents` |
| Secure upload | Presigned S3 + document actions |
| Branded portal when advisor branding on | `ClientDocumentPortal` |

**Code:** `src/app/(protected)/documents/page.tsx`, `src/lib/actions/document-actions.ts`

**Gap:** Automated reminder emails for missing documents (v1.4 DOC-05) — verify `workflow-reminders.ts` coverage.

---

## US-28 — See Workspace Priorities (Advisor)

**Status: Code-only**

| Capability | Implementation |
|------------|----------------|
| Prioritized action list on advisor hub | `deriveAdvisorPriorities` |
| Intakes awaiting review, documents, stalled, invitations | Links to pipeline / invitations |

**Code:** `src/lib/advisor/workspace-data.ts`, `/advisor` workspace home

**Related surfaces (same epic family):**

| Surface | Route | Notes |
|---------|-------|--------|
| Governance dashboard | `/advisor/dashboard` | Portfolio analytics, heat maps |
| Intelligence | `/advisor/intelligence` | See [Epic 5.9](./EPIC-5.9-extended-risk-modules.md) |
| Per-client analytics | `/advisor/analytics/[clientId]` | Trend / drill-down |
| Notifications | `/advisor/notifications` | In-app notification center |
| Advisor question bank (read-only) | `/advisor/question-bank/[riskAreaId]` | Visibility preview |

---

## Playwright coverage

| Area | Status |
|------|--------|
| Pipeline list / client detail | **Partial** — `advisor-clients.spec.ts` (not full pipeline) |
| Document upload | **Not implemented** |
| SSE refresh | **Not implemented** |

## Related

- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — intake review, reports
- [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md) — invitation stage in pipeline
