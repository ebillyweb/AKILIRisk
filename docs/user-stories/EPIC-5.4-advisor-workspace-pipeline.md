# Epic 5.4 — Advisor Workspace, Pipeline & Documents

**Index:** [User stories README](./README.md)  
**Status:** Reconciled against codebase (2026-05-23). Core pipeline, documents, intelligence, and notifications are **shipped**; several **Partial** / **Gap** items remain.  
**BRD alignment:** FR-7 (advisor workspace), Section 3.4 business rules; v1.4 roadmap requirements **STATUS-***, **DOC-***, **NOTIFY-*** (see [.planning/milestones/v1.4-ROADMAP.md](../../.planning/milestones/v1.4-ROADMAP.md), phases 016–018).

**Advisor UI (primary):** `/advisor`, `/advisor/pipeline`, `/advisor/pipeline/[clientId]`, `/advisor/intelligence`, `/advisor/settings/notifications`  
**Client UI:** `/documents`

## Story numbering

This epic uses **US-28 – US-36** (BRD / product brief). Older repo docs listed **US-24 – US-28** for the same scope:

| This epic (US-28–36) | Former repo ID | Topic |
|----------------------|----------------|--------|
| US-28 | US-24 | Client pipeline |
| US-29 | US-28 | Workspace priorities |
| US-30 | US-26 | Document requirements (advisor) |
| US-31 | US-27 (client) | Document upload |
| US-32 | US-27 (advisor) | Document download |
| — | US-25 | Client workflow detail (timeline, reports entry) — **folded into US-28** |

**Collision:** **US-35** here is *advisor notification preferences*. Epic [5.6](./EPIC-5.6-account-security-compliance.md) also uses **US-35** for *client MFA*. Renumber 5.6+ in a future BRD pass or treat 5.4 US-35 as the advisor-notification story only in this file.

## Reconciliation status key

| Status | Meaning |
|--------|---------|
| **Done** | Acceptance criteria met; code and story align |
| **Partial** | Core behavior shipped; gaps or deviations noted |
| **Gap** | Story AC not met or implementation incorrect |
| **Code-only** | Shipped; AC not yet promoted to BRD |

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-28 | Manage the client pipeline | **Partial** | Doc counts + in-progress assessment + stalled UI fixed 2026-05-23; intake-review priority still coarse |
| US-29 | Act on advisor priorities | **Partial** | Metrics fixed; intake “review” ≠ advisor approval |
| US-30 | Define document requirements | **Partial** | Required/optional UI; stage gates mandatory only |
| US-31 | Upload required documents (client) | **Partial** | Advisor notify wired; Playwright still open |
| US-32 | Review and download client documents | **Partial** | Shipped; Playwright still open |
| US-33 | View portfolio risk intelligence | **Partial** | Shipped; Playwright still open |
| US-34 | Drill into family risk detail | **Partial** | Shipped; Playwright still open |
| US-35 | Manage notification preferences | **Partial** | Quiet hours UI added; UTC only |
| US-36 | Receive automated workflow reminders | **Partial** | 30-day advisor escalation; client reminders unchanged |

---

## US-28 — Manage the Client Pipeline (Advisor)

**As an** advisor, **I want** a pipeline view of every client, **so that** I can track progress and prioritize my attention.

**Status: Partial**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Each assigned client shows workflow stage and completion % (Invited 10% → Complete 100%) | **Done** — `computeProgress` in `src/lib/pipeline/status.ts` |
| 2 | Clients with no activity for **more than 7 days** who are not Complete are **flagged stalled** | **Partial** — `isStalled()` + aggregate metric; **no per-row flag** in `PipelineTable`; threshold uses `> 7` days (effectively 8+ calendar days) |
| 3 | Filter by stage, search by name, sort by name / stage / progress / last activity | **Done** — `PipelineFilters`, `PipelineTable` (TanStack), `usePipelineFilters` |
| 4 | Clients whose assignment is not **ACTIVE** are excluded | **Done** — `getClientPipeline` filters `status: 'ACTIVE'` |

### Implementation

| Capability | Location |
|------------|----------|
| Pipeline list + metrics | `/advisor/pipeline`, `getClientPipeline`, `getPipelineMetrics` |
| Stage computation | `src/lib/pipeline/status.ts` — `computeClientStage`, `computeProgress`, `isStalled` |
| Queries | `src/lib/pipeline/queries.ts` |
| Real-time refresh | `/api/advisor/status-stream`, `usePipelineUpdates` |
| Client drill-down | `/advisor/pipeline/[clientId]` — `ClientDetailView`, `WorkflowTimeline` |
| Intake waiver in stage | `intakeWaivedAt` on `ClientAdvisorAssignment` |
| Report entry from pipeline | `/advisor/pipeline/[clientId]/report` — see [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) |

### Known gaps / bugs

1. **Document count aggregation breaks stage and metrics** — `groupBy` in `getClientPipeline` stores the *unfulfilled* count in `documents.required`, but `computeClientStage` expects *total* required vs fulfilled. Example: 2 fulfilled + 1 open can show **COMPLETE** instead of **DOCUMENTS_REQUIRED**. Fix: count `required: true` rows separately; pass total required and fulfilled into `computeClientStage`.
2. **Assessment in progress often missing** — pipeline query only includes `assessments` with `status: 'COMPLETED'`. Clients mid-assessment without a prior completion may not show **ASSESSMENT_IN_PROGRESS**.
3. **Stalled visibility** — `metrics.stalled` appears on the overview strip; individual rows are not badged or filterable as “stalled only.”
4. **Documents column display** — `fulfilled/required` in the table reflects the mis-aggregated counts until (1) is fixed.

**Reconciliation with Epic 5.1:** Invitation stages feed `computeClientStage` via batched `InviteCode` lookup.

---

## US-29 — Act on Advisor Priorities (Advisor)

**As an** advisor, **I want** a prioritized list of clients needing action, **so that** I always know what to do next.

**Status: Partial**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Clients at **Intake Complete** appear as awaiting intake review | **Partial** — all `INTAKE_COMPLETE` stage clients counted; not limited to intake **pending advisor approval** ([Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) `/advisor/review/[id]`) |
| 2 | Clients with unfulfilled document requirements appear as document actions | **Partial** — `metrics.documentsNeeded` (inherits US-28 doc-count bug) |
| 3 | Stalled clients appear as stalled items | **Done** — `deriveAdvisorPriorities` |
| 4 | Pipeline metrics: counts by stage, documents needed, stalled | **Done** on `/advisor` hub + pipeline overview (documents count unreliable until US-28 fix) |

### Implementation

| Capability | Location |
|------------|----------|
| Priority derivation | `src/lib/advisor/workspace-data.ts` — `deriveAdvisorPriorities` |
| Workspace home | `/advisor` — `AdvisorWorkspaceHome` |
| Intelligence highlights (related) | `deriveIntelligenceHighlights` → `/advisor/intelligence` |

**Gap:** Priority cards link to `/advisor/pipeline` without stage-specific query params (e.g. `?stage=INTAKE_COMPLETE` or stalled filter).

---

## US-30 — Define Document Requirements for a Client (Advisor)

**As an** advisor, **I want** to specify the documents a client must provide, **so that** I collect everything I need for their file.

**Status: Partial**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Create requirement with name, optional description, required or optional | **Partial** — name + description; `DocumentRequirement.required` exists in schema but **not exposed** in `addDocumentRequirement` or `DocumentRequirements` UI (always `true`) |
| 2 | Unfulfilled until matching file uploaded | **Done** |
| 3 | Unfulfilled **required** docs after assessment complete → **Documents Required** not Complete | **Gap** — stage logic does not filter `required: true`; doc-count bug (US-28) |

### Implementation

| Capability | Location |
|------------|----------|
| Add / remove | `addDocumentRequirement`, `removeDocumentRequirement` in `src/lib/actions/pipeline-actions.ts` |
| UI | `src/components/pipeline/DocumentRequirements.tsx` on client detail |
| Model | `DocumentRequirement` in `prisma/schema.prisma` |

**Undocumented:** Advisors can upload on behalf of the client via `DocumentUpload` embedded on the client detail page (same presigned flow as the client portal).

---

## US-31 — Upload Required Documents (Client)

**As a** client, **I want** to upload the documents my advisor requested, **so that** I can complete my onboarding.

**Status: Partial**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Only PDF, PNG, JPEG up to 10 MB | **Done** — `src/lib/documents/validation.ts`, `ALLOWED_FILE_TYPES`, dropzone on `DocumentUpload` |
| 2 | Success marks requirement fulfilled with timestamp | **Done** — `fulfilled`, `fulfilledAt` on confirm |
| 3 | Advisor notified on upload | **Gap** — `triggerDocumentUploadNotification` in `src/lib/notifications/triggers.ts` is **never called** from `confirmDocumentUpload` or `/api/documents/confirm` |
| 4 | Cannot access another client’s requirement | **Done** — `getDocumentRequirementForSessionUser` |

### Implementation

| Capability | Location |
|------------|----------|
| Client portal | `/documents`, `ClientDocumentPortal` |
| Presigned upload | `POST /api/documents/upload-url`, `confirmDocumentUpload` / `POST /api/documents/confirm` |
| S3 | `src/lib/documents/s3.ts` |
| Branded portal | Advisor branding on document portal when enabled ([Epic 5.7](./EPIC-5.7-billing-branding-whitelabel.md)) |

**Hardening:** Confirm path should optionally re-validate MIME from S3 `HEAD` against `ALLOWED_FILE_TYPES` (upload-url already validates).

---

## US-32 — Review and Download Client Documents (Advisor)

**As an** advisor, **I want** to view and download the documents my clients upload, **so that** I can complete their review.

**Status: Partial**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Download fulfilled requirement via secure, time-limited link | **Done** — `getDocumentDownloadUrl`, `generateDownloadUrl` (1 hour) |
| 2 | Cannot access another advisor’s client documents | **Done** — `requirement-access.ts` + assignment on pipeline detail |
| 3 | Download link expires after one hour | **Done** — `expiresIn: 3600` in `s3.ts` |

### Implementation

| Capability | Location |
|------------|----------|
| Download action | `src/lib/actions/document-actions.ts` |
| UI | `DocumentDownloadButton` on client detail |

**Gap:** No Playwright test for cross-advisor document download denial (pipeline tenant test covers `getClientDetail` only).

---

## US-33 — View Portfolio Risk Intelligence (Advisor)

**As an** advisor, **I want** a portfolio-level view of risk across all my clients, **so that** I can spot the families most in need of attention.

**Status: Partial** (shipped; previously under-documented in this epic)

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Completed-assessment clients: total families, at risk, critical exposure count | **Done** — `getPortfolioIntelligence` |
| 2 | Pillar severity: critical ≤ 3.0, moderate ≤ 5.0, else low | **Done** — `getSeverity()` in `src/lib/intelligence/queries.ts` |
| 3 | Per-client per-pillar heat map; risks grouped by category | **Done** — `RiskHeatMap`, `getPortfolioPillarScores`, `PortfolioRiskList` |

### Implementation

| Capability | Location |
|------------|----------|
| Page | `/advisor/intelligence` |
| Data | `src/lib/intelligence/queries.ts`, `getPortfolioIntelligenceData` in `advisor-actions.ts` |
| UI | `RiskSummaryCard`, `RiskDistributionChart`, `RiskHeatMap` |

**Do not confuse with:** `/advisor/dashboard` — governance portfolio table (`GovernanceTable`, `MetricsCards`), separate from intelligence heat map.

**Related:** Extended/legacy module narrative in [Epic 5.9](./EPIC-5.9-extended-risk-modules.md); canonical governance scoring is Epic 5.2.

---

## US-34 — Drill into a Family's Risk Detail (Advisor)

**As an** advisor, **I want** detailed risk findings for a single family, **so that** I can advise them specifically.

**Status: Partial**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Active assignment: three lowest-scoring pillars with recommendations | **Done** — `getRiskDetailForFamily`, top 3 by score |
| 2 | Each top risk shows underlying assessment responses | **Done** — `assessmentResponses` on `RiskDetail` |
| 3 | Not assigned: cannot view risk detail | **Done** — `ClientAdvisorAssignment` ACTIVE check |

### Implementation

| Capability | Location |
|------------|----------|
| Page | `/advisor/intelligence/[familyId]` |
| UI | `RiskDetailPanel` |
| Actions | `getFamilyRiskDetailData` → `getRiskDetailForFamily` |

**Gap:** No smoke test for cross-advisor intelligence URL access.

---

## US-35 — Manage Notification Preferences (Advisor)

**As an** advisor, **I want** to control which notifications I receive, **so that** I am alerted on my own terms.

**Status: Partial** — *Not the same as Epic 5.6 US-35 (client MFA).*

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Disable category (milestones, reminders, stalled, registrations) → no email for that category | **Done** — `shouldSendNotification`, `NotificationPreferencesForm` |
| 2 | In-app notifications still recorded regardless of email prefs | **Done** — in-app created when `advisorProfileId` set; email gated separately |
| 3 | Quiet hours suppress notifications during window | **Partial** — `quietStart` / `quietEnd` in DB + `isInQuietHours()`; **no UI** to set times; not in `updateNotificationPreferencesAction` |
| 4 | Duplicate in-app notification within 24 hours not created | **Done** — `isDuplicateNotification` in `src/lib/notifications/service.ts` |

### Implementation

| Capability | Location |
|------------|----------|
| Settings page | `/advisor/settings/notifications` |
| Preferences | `src/lib/notifications/preferences.ts` |
| Dispatch | `src/lib/notifications/service.ts`, `src/lib/notifications/triggers.ts` |
| In-app center | `/advisor/notifications` |

**Categories map:** `registration`, `milestone`, `reminder`, `stalled` → `NotificationPreference` email* fields.

---

## US-36 — Receive Automated Workflow Reminders (System)

**As the** platform, **I want** to send reminders automatically, **so that** clients and advisors stay engaged without manual chasing.

**Status: Partial**

### Acceptance criteria

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Intake in progress **> 7 days** → client reminder | **Done** — `processAssessmentReminders` |
| 2 | Assessment in progress **> 14 days** → client reminder | **Done** — same |
| 3 | Document requirement **> 3 days** unfulfilled, remind at most every **7 days** | **Done** — `processDocumentReminders`, `lastReminderSentAt` |
| 4 | Client stalled **> 30 days** → advisor escalation | **Gap** — `processWorkflowReminders` uses `isStalled()` (**> 7 days**) for advisor email; `isEscalation` at 30 days does not change category or messaging |

### Implementation

| Job | Endpoint | Module |
|-----|----------|--------|
| Assessment + workflow stall (advisor) | `GET /api/cron/workflow-reminders` | `assessment-reminders.ts`, `workflow-reminders.ts` |
| Document reminders (client) | `GET /api/cron/document-reminders` | `document-reminders.ts` |

**Security:** `Authorization: Bearer $CRON_SECRET` on cron routes.

**Other issues:** Workflow reminder client link uses `/advisor/clients/{id}` while pipeline uses `/advisor/pipeline/{id}`; invitation lookup in `workflow-reminders.ts` is fragile for stage computation.

---

## Related surfaces (same epic family)

Documented here so reconcilers do not treat them as “undocumented code.”

| Surface | Route | Notes |
|---------|-------|--------|
| Advisor workspace home | `/advisor` | Priorities + activity (US-29) |
| Governance dashboard | `/advisor/dashboard` | Not US-33 intelligence; pillar governance table |
| Per-client analytics | `/advisor/analytics/[clientId]` | Trend / drill-down |
| Notifications center | `/advisor/notifications` | In-app feed |
| Advisor question bank preview | `/advisor/question-bank/[riskAreaId]` | Read-only visibility |
| Client document portal | `/documents` | US-31 |

**Phase verification (more detail than this file):** `.planning/phases/016-client-status-pipeline/`, `017-*`, `018-*` VERIFICATION.md files.

---

## Playwright & unit test coverage

See [tests/INVENTORY.md](../../tests/INVENTORY.md).

| Area | Spec / test | Status |
|------|-------------|--------|
| Pipeline load + open client detail | `tests/smoke/advisor-clients.spec.ts` | Implemented |
| Pipeline → intake review | `tests/smoke/advisor-intake-review.spec.ts` | Implemented |
| Cross-advisor pipeline detail blocked | `tests/smoke/tenant-isolation.spec.ts` | Implemented |
| Billing gate on pipeline / hub / dashboard | `tests/smoke/advisor-billing-gate.spec.ts` | Implemented |
| Stage % / DOCUMENTS_REQUIRED / COMPLETE accuracy | — | **Not implemented** |
| Stalled row flag or filter | — | **Not implemented** (INVENTORY TODO) |
| Pipeline metrics vs DB | — | **Not implemented** (INVENTORY TODO) |
| Filter / search / sort | — | **Not implemented** (INVENTORY TODO) |
| SSE live refresh | — | **Not implemented** |
| Document upload / download | — | **Not implemented** |
| Portfolio intelligence / family detail | — | **Not implemented** |
| Notification preferences | — | **Not implemented** |
| Cron reminders | — | **Not implemented** (needs `CRON_SECRET` + fixtures) |

**Recommended unit tests:** `computeClientStage`, `computeProgress`, `isStalled`, `getPipelineMetrics`, document `groupBy` aggregation in `queries.ts` (Vitest).

---

## Engineering backlog (priority)

**Done (2026-05-23):** items 1–7 below shipped in code; Vitest `src/lib/pipeline/status.test.ts` added.

**Remaining:**

1. Playwright: documents, intelligence tenant isolation, notification prefs, pipeline filters.
2. US-29: align “intakes awaiting review” with Epic 5.2 advisor approval state (not only `INTAKE_COMPLETE` stage).
3. Confirm-path MIME re-check from S3 `HEAD` against allowlist (defense in depth).
4. Local-time quiet hours (currently UTC in UI copy and server).

---

## Related epics

- [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md) — invitation stages in pipeline
- [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) — intake approval, assessment, reports from pipeline
- [Epic 5.7](./EPIC-5.7-billing-branding-whitelabel.md) — branded document portal
- [Epic 5.9](./EPIC-5.9-extended-risk-modules.md) — legacy risk modules vs canonical intelligence
