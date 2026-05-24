# Epic 5.4 — Advisor Workspace, Pipeline & Documents

**Index:** [User stories README](./README.md)  
**Status:** **Reconciled** against codebase (2026-05-23). Implementation complete for US-28–US-36; Playwright smoke in `epic-5.4-advisor-workspace.spec.ts`.  
**BRD alignment:** FR-7 (advisor workspace), Section 3.4 business rules; v1.4 **STATUS-***, **DOC-***, **NOTIFY-*** (see [.planning/milestones/v1.4-ROADMAP.md](../../.planning/milestones/v1.4-ROADMAP.md), phases 016–018).

**Advisor UI:** `/advisor`, `/advisor/pipeline`, `/advisor/pipeline/[clientId]`, `/advisor/intelligence`, `/advisor/settings/notifications`  
**Client UI:** `/documents`

## Story numbering

This epic uses **US-28 – US-36**. Older repo docs listed **US-24 – US-28** for the same scope (see mapping in [README](./README.md)).

**Collision:** **US-35** here is *advisor notification preferences*. Epic [5.6](./EPIC-5.6-account-security-compliance.md) uses **US-35** for *client MFA* — disambiguate by title in BRD appendix.

## Reconciliation status key

| Status | Meaning |
|--------|---------|
| **Done** | Acceptance criteria met; code and story align |
| **Partial** | Shipped with minor documented deviation |
| **Gap** | Not met |
| **Code-only** | Shipped; not yet in BRD body |

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-28 | Manage the client pipeline | **Done** | Stages, SSE, filters, stalled badge/filter, URL query params |
| US-29 | Act on advisor priorities | **Done** | Intake review count uses approval state; deep links |
| US-30 | Define document requirements | **Done** | Required/optional; stage gates mandatory only |
| US-31 | Upload required documents (client) | **Done** | Notify advisor; MIME validated on confirm |
| US-32 | Review and download client documents | **Done** | Presigned download + tenant isolation |
| US-33 | View portfolio risk intelligence | **Done** | `/advisor/intelligence` |
| US-34 | Drill into family risk detail | **Done** | Assignment gate + smoke isolation test |
| US-35 | Manage notification preferences | **Done** | Quiet hours in local time (stored UTC) |
| US-36 | Receive automated workflow reminders | **Done** | 30-day advisor escalation; client/doc crons |

---

## US-28 — Manage the Client Pipeline (Advisor)

**Status: Done**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Workflow stage + completion % (10% → 100%) | **Done** |
| 2 | No activity **> 7 days**, not Complete → **stalled** | **Done** — row badge, metric, `?stalled=1` filter |
| 3 | Filter by stage, search, sort | **Done** |
| 4 | Non-**ACTIVE** assignments excluded | **Done** |

### Implementation

| Capability | Location |
|------------|----------|
| Pipeline + metrics | `getClientPipeline`, `getPipelineMetrics`, `/advisor/pipeline` |
| Stage logic | `src/lib/pipeline/status.ts` |
| Mandatory documents | `src/lib/pipeline/documents.ts` |
| SSE refresh | `/api/advisor/status-stream`, `usePipelineUpdates` |
| URL filters | `parsePipelineFiltersFromSearchParams` — `?stage=`, `?stalled=1`, `?awaitingReview=1`, `?documentsNeeded=1` |
| Client detail | `/advisor/pipeline/[clientId]` |

---

## US-29 — Act on Advisor Priorities (Advisor)

**Status: Done**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Intakes **awaiting review** (submitted, not approved/rejected) | **Done** — `metrics.intakesAwaitingReview`, not raw `INTAKE_COMPLETE` count |
| 2 | Unfulfilled **required** documents | **Done** — `metrics.documentsNeeded` |
| 3 | Stalled clients | **Done** |
| 4 | Metrics by stage, documents, stalled | **Done** |

### Implementation

`deriveAdvisorPriorities` in `src/lib/advisor/workspace-data.ts` — links to `/advisor/review/[id]`, `/advisor/pipeline?awaitingReview=1`, `?documentsNeeded=1`, `?stalled=1`.

**Intake review rule:** `isIntakeAwaitingAdvisorReview` in `src/lib/pipeline/intake-review.ts` (SUBMITTED + approval `PENDING` / `IN_REVIEW` / missing; excludes waived).

---

## US-30 — Define Document Requirements (Advisor)

**Status: Done**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Name, description, **required or optional** | **Done** |
| 2 | Unfulfilled until upload | **Done** |
| 3 | Unfulfilled **required** after assessment → **Documents Required** | **Done** |

### Implementation

`addDocumentRequirement`, `DocumentRequirements.tsx`, `DocumentRequirement.required` in Prisma.

**Note:** Advisors may upload on behalf of clients from client detail (`DocumentUpload`).

---

## US-31 — Upload Required Documents (Client)

**Status: Done**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | PDF, PNG, JPEG ≤ 10 MB | **Done** |
| 2 | Fulfilled + timestamp | **Done** |
| 3 | Advisor notified | **Done** — `triggerDocumentUploadNotification` on client confirm |
| 4 | Tenant isolation | **Done** |

### Implementation

`/documents`, presigned upload, `validateFileUpload` + `validateStoredDocumentMime` on confirm.

---

## US-32 — Review and Download Client Documents (Advisor)

**Status: Done**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Secure download, 1-hour presigned URL | **Done** |
| 2 | Cross-advisor denied | **Done** |
| 3 | Link expires after one hour | **Done** |

---

## US-33 — View Portfolio Risk Intelligence (Advisor)

**Status: Done**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Totals for completed-assessment families | **Done** |
| 2 | Severity ≤3.0 critical, ≤5.0 moderate | **Done** |
| 3 | Heat map + risks by category | **Done** |

**Route:** `/advisor/intelligence` (not `/advisor/dashboard` governance table).

---

## US-34 — Drill into a Family's Risk Detail (Advisor)

**Status: Done**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Top 3 lowest pillars + recommendations | **Done** |
| 2 | Underlying responses | **Done** |
| 3 | Unassigned → no access | **Done** |

**Route:** `/advisor/intelligence/[familyId]`

---

## US-35 — Manage Notification Preferences (Advisor)

**Status: Done** — *Not Epic 5.6 client MFA.*

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Per-category email toggles | **Done** |
| 2 | In-app always recorded | **Done** |
| 3 | Quiet hours suppress email | **Done** — local time in UI, stored UTC (`quiet-hours.ts`) |
| 4 | No duplicate in-app within 24h | **Done** |

**Route:** `/advisor/settings/notifications`

---

## US-36 — Receive Automated Workflow Reminders (System)

**Status: Done**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Intake in progress > 7d → client reminder | **Done** — `processAssessmentReminders` |
| 2 | Assessment in progress > 14d → client reminder | **Done** |
| 3 | Document > 3d unfulfilled, max every 7d | **Done** — `processDocumentReminders` |
| 4 | Stalled **> 30d** → advisor escalation | **Done** — `isWorkflowEscalation` in `workflow-reminders.ts` |

| Cron | Path |
|------|------|
| Assessment + advisor escalation | `GET /api/cron/workflow-reminders` |
| Document reminders | `GET /api/cron/document-reminders` |

Requires `Authorization: Bearer $CRON_SECRET`.

---

## Related surfaces

| Surface | Route |
|---------|-------|
| Workspace home | `/advisor` |
| Governance dashboard | `/advisor/dashboard` |
| Per-client analytics | `/advisor/analytics/[clientId]` |
| Notifications | `/advisor/notifications` |
| Question bank preview | `/advisor/question-bank/[riskAreaId]` |

---

## Test coverage

### Vitest

| Module | File |
|--------|------|
| Stage + stall/escalation | `src/lib/pipeline/status.test.ts` |
| Intake awaiting review | `src/lib/pipeline/intake-review.test.ts` |
| Quiet hours conversion | `src/lib/notifications/quiet-hours.test.ts` |

### Playwright

| Spec | Covers |
|------|--------|
| `tests/smoke/epic-5.4-advisor-workspace.spec.ts` | Pipeline search, stalled URL filter, intelligence tenant isolation, notification settings |
| `tests/smoke/advisor-clients.spec.ts` | Pipeline load + client detail |
| `tests/smoke/advisor-intake-review.spec.ts` | Pipeline → intake review |
| `tests/smoke/tenant-isolation.spec.ts` | Cross-advisor pipeline detail |

**Not automated:** full S3 document upload E2E (needs object storage in CI); cron job execution; SSE refresh assertion.

---

## v1.4 requirement traceability

| ID | Story | Status |
|----|-------|--------|
| STATUS-01–06 | US-28, US-29 | Done |
| DOC-01–05 | US-30–31, US-36 | Done |
| NOTIFY-01–05 | US-31, US-35, US-36 | Done |
| (portfolio intelligence) | US-33–34 | Done — add INTEL-* to BRD when promoted |

---

## Related epics

- [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md) — invitation stages
- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — intake approval, reports
- [Epic 5.7](./EPIC-5.7-billing-branding-whitelabel.md) — branded document portal
- [Epic 5.9](./EPIC-5.9-extended-risk-modules.md) — legacy risk modules
