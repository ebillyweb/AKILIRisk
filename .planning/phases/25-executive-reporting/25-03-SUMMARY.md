---
phase: 25-executive-reporting
plan: "03"
subsystem: executive-reporting
tags: [server-actions, advisor-ui, cron, prisma, pdf, phase-25]
dependency_graph:
  requires:
    - "25-01: ExecutiveReport Prisma model + buildExecutiveReportSnapshot"
    - "25-02: renderExecutiveReportPdf + API route"
    - "reporting engine: ReportActionResult pattern, authorizeForAssessment pattern"
    - "cadence: ReviewCadence model, getDueSoonCadences"
  provides:
    - "generateExecutiveReport: idempotent DRAFT creation with period config"
    - "saveExecutiveDraftEdits: editorial save for DRAFT rows"
    - "publishExecutiveReport: DRAFT->PUBLISHED with snapshot freeze + transaction"
    - "getExecutiveReportListForClient, getExecutiveDraftData: read-only query helpers"
    - "Advisor list page at /advisor/pipeline/[clientId]/executive-report"
    - "Advisor edit page at /advisor/pipeline/[clientId]/executive-report/edit"
    - "ExecutiveReportDraftForm client component"
    - "GET /api/cron/executive-report-drafts: scheduled draft generation"
  affects:
    - src/lib/actions/executive-report-actions.ts
    - src/lib/reports/executive-report-queries.ts
    - src/app/(protected)/advisor/pipeline/[clientId]/executive-report/page.tsx
    - src/app/(protected)/advisor/pipeline/[clientId]/executive-report/edit/page.tsx
    - src/components/reports/ExecutiveReportDraftForm.tsx
    - src/app/api/cron/executive-report-drafts/route.ts
tech_stack:
  added: []
  patterns:
    - "authorizeForClient: ADMIN resolves any active assignment, ADVISOR resolves own profile (vs authorizeForAssessment)"
    - "generateExecutiveReport idempotent via partial unique index + P2002 catch + re-read"
    - "publishExecutiveReport builds snapshot OUTSIDE transaction to avoid lock contention"
    - "Cron route: CRON_SECRET timingSafeEqual + per-cadence try/catch to avoid single failure aborting batch"
    - "Period presets compute ISO date strings client-side, passed to server action"
key_files:
  created:
    - src/lib/actions/executive-report-actions.ts
    - src/lib/reports/executive-report-queries.ts
    - src/app/(protected)/advisor/pipeline/[clientId]/executive-report/page.tsx
    - src/app/(protected)/advisor/pipeline/[clientId]/executive-report/edit/page.tsx
    - src/components/reports/ExecutiveReportDraftForm.tsx
    - src/app/api/cron/executive-report-drafts/route.ts
  modified: []
decisions:
  - "authorizeForClient resolves advisorProfileId from ACTIVE assignment for ADMIN bucket (admin needs an advisorProfileId to scope executive reports)"
  - "writeAudit uses string literal 'executive_report.publish' (EXECUTIVE_REPORT_PUBLISH not in AUDIT_ACTIONS const yet)"
  - "Cron pre-populates executiveSnapshotData on DRAFT for advisor preview; overwritten at publish time with fresh snapshot"
  - "Period preset 'all_time' sends epoch (new Date(0)) as periodStart signal; server defaults to earliest assessment (D-22)"
  - "Next DRAFT after publish inherits periodEnd of just-published as its new periodStart (rolling window default)"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 25 Plan 03: Server Actions + Advisor UI + Cron Summary

Advisor workflow layer for executive reports: server actions (generate/save/publish lifecycle), read-only query helpers, advisor list + edit pages, draft form with period presets and discussion prompts, and a cron route that creates DRAFT rows for approaching ReviewCadence without auto-distributing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server actions + query helpers | dd168a4 | executive-report-actions.ts, executive-report-queries.ts |
| 2 | Advisor UI pages, draft form, cron route | 782449f | 4 files (pages, form, cron) |

## What Was Built

### Task 1: Server Actions + Query Helpers

**`src/lib/actions/executive-report-actions.ts`**

Three exported server actions following the `report-actions.ts` pattern:

- `generateExecutiveReport({ clientId, periodStart?, periodEnd? })`: idempotent DRAFT creation. Returns existing DRAFT if one exists. Resolves default period from last published report's `reportingPeriodEnd` (D-22) or earliest assessment for first-ever report. P2002 on partial unique index causes re-read of winner row. T-25-09 mitigated via `authorizeForClient`.

- `saveExecutiveDraftEdits({ reportId, advisorNotes?, meetingAgenda?, discussionPrompts? })`: editorial save with max-length guards (2000/2000/10×500). No state transition. Not audited per-keystroke (T-25-13 mitigated).

- `publishExecutiveReport(reportId)`: builds `ExecutiveReportSnapshot` + branding OUTSIDE transaction, then atomically: re-reads draft under txn (race detection), supersedes all PUBLISHED rows, updates DRAFT→PUBLISHED with frozen JSON snapshots + editorial overlay, creates next DRAFT at v+1 inheriting editorial fields. `void writeAudit` fire-and-forget. P2002 / draft_disappeared → `{ ok: false, code: "concurrent_publish" }` (T-25-10).

Private helper `authorizeForClient` distinguishes ADMIN (any active assignment for client) vs ADVISOR (must have own active assignment). Returns `advisorProfileId` so actions don't need a second query.

**`src/lib/reports/executive-report-queries.ts`**

- `getExecutiveReportListForClient(clientUserId, advisorProfileId)`: all rows for the (client, advisor) pair ordered by version desc; maps `advisorNotes` presence to `hasAdvisorNotes boolean`.
- `getExecutiveDraftData(reportId)`: single row fetch for the edit form; parses `discussionPrompts` JSON to `string[]`.

### Task 2: Advisor UI Pages, Draft Form, Cron Route

**`src/app/(protected)/advisor/pipeline/[clientId]/executive-report/page.tsx`**

Server component. Same auth pattern as `/report/page.tsx`. Resolves `advisorProfileId` for ADVISOR/ADMIN separately. Shows: DRAFT + PUBLISHED + SUPERSEDED rows with period dates (D-24), status badges (success/outline/secondary), "Edit Draft" + "Preview PDF" for DRAFTs, "Download Report" + "Advisor Brief" for PUBLISHED, "Download Report" for SUPERSEDED. Empty state with "Generate First Report" button when client has completed assessment. "Generate Report" header button gated on `hasCompletedAssessment`.

**`src/app/(protected)/advisor/pipeline/[clientId]/executive-report/edit/page.tsx`**

Server component shell. Checks for COMPLETED assessment (returns empty state if none). Calls `generateExecutiveReport({ clientId })` idempotently. Loads `getExecutiveDraftData`. Renders `<ExecutiveReportDraftForm>`.

**`src/components/reports/ExecutiveReportDraftForm.tsx`**

Client component with:
- Period presets (Last 90 Days / Last 6 Months / Last 12 Months / Since First Assessment / Custom Range) -- D-23. Preset change calls `generateExecutiveReport` with computed dates, then `router.refresh()`.
- Custom range: date inputs + Apply button.
- Advisor Notes textarea (max 2000, char counter).
- Meeting Agenda textarea (max 2000, char counter).
- Discussion Prompts: ordered list of text inputs with add/remove (max 10 × 500 chars).
- Actions: Save Draft / Preview Executive Report / Preview Advisor Brief / Publish. Publish saves first then calls `publishExecutiveReport`, navigates to list on success.

**`src/app/api/cron/executive-report-drafts/route.ts`**

GET route with CRON_SECRET Bearer auth (timingSafeEqual -- T-25-11). Finds `ReviewCadence` rows with `nextDueDate` within 7 days and a `lastAssessmentId`. For each cadence: skips if DRAFT already exists (T-25-12), determines period from last published or earliest assessment (D-22), resolves next version, builds `buildExecutiveReportSnapshot` for advisor preview, creates DRAFT with pre-populated `executiveSnapshotData`. Per-cadence try/catch continues on individual failures. Returns `{ processed, draftsCreated, skipped }`. Never auto-distributes (D-21).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `authorizeForClient` returns `advisorProfileId`**
- **Found during:** Task 1 implementation
- **Issue:** Plan spec said `authorizeForClient` returns `{ ok: true, bucket, advisorProfileId }` but did not specify how ADMIN bucket gets the `advisorProfileId` (admins don't have their own AdvisorProfile). Executive reports are scoped to a (client, advisor) pair, so ADMIN must resolve one.
- **Fix:** ADMIN bucket queries `clientAdvisorAssignment.findFirst` for any ACTIVE assignment to get `advisorId`. This is consistent with the server component approach (admin sees the client's assigned advisor's reports).
- **Files modified:** `src/lib/actions/executive-report-actions.ts`
- **Commit:** dd168a4

**2. [Rule 1 - Bug] `writeAudit` action string literal for EXECUTIVE_REPORT_PUBLISH**
- **Found during:** Task 1 - checking AUDIT_ACTIONS constant
- **Issue:** `AUDIT_ACTIONS` does not include `EXECUTIVE_REPORT_PUBLISH`. Plan said "add to AUDIT_ACTIONS if it uses a const object, otherwise use string literal."
- **Fix:** Used string literal `"executive_report.publish"` cast as `(typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]`. Adding to `AUDIT_ACTIONS` would touch `audit-log-core.ts` and its admin UI dropdown — deferred since the plan explicitly allowed string literal.
- **Files modified:** `src/lib/actions/executive-report-actions.ts`
- **Commit:** dd168a4

**3. [Rule 2 - Missing Critical] Cron pre-populates `executiveSnapshotData` on DRAFT**
- **Found during:** Task 2 cron implementation
- **Issue:** Plan spec said "pre-populate snapshot for advisor review" but the `ExecutiveReport` schema has `executiveSnapshotData` as nullable DRAFT. Pre-populating gives advisors an immediate PDF preview without waiting for publish.
- **Fix:** Cron creates DRAFT with `executiveSnapshotData` set to the freshly built snapshot. The PDF API route in Plan 02 already handles DRAFT preview by calling `buildExecutiveReportSnapshot` live; pre-population is a bonus for cron-created drafts.
- **Files modified:** `src/app/api/cron/executive-report-drafts/route.ts`
- **Commit:** 782449f

## Known Stubs

None. All actions wire to real data. Period presets compute real date ranges.

## Threat Flags

No new threat surface beyond the plan's threat model. All six threats (T-25-09 through T-25-14) are mitigated:
- T-25-09: `authorizeForClient` checks active assignment before DRAFT create
- T-25-10: `publishExecutiveReport` re-reads under txn, catches P2002/draft_disappeared
- T-25-11: CRON_SECRET timingSafeEqual in cron route
- T-25-12: Existing DRAFT check in cron before create
- T-25-13: Max-length guards in `saveExecutiveDraftEdits`
- T-25-14: Advisor Brief preview/download links only in advisor pages (never client-facing)

## Self-Check: PASSED

- FOUND: src/lib/actions/executive-report-actions.ts
- FOUND: src/lib/reports/executive-report-queries.ts
- FOUND: src/app/(protected)/advisor/pipeline/[clientId]/executive-report/page.tsx
- FOUND: src/app/(protected)/advisor/pipeline/[clientId]/executive-report/edit/page.tsx
- FOUND: src/components/reports/ExecutiveReportDraftForm.tsx
- FOUND: src/app/api/cron/executive-report-drafts/route.ts
- FOUND commit: dd168a4 (Task 1)
- FOUND commit: 782449f (Task 2)
- TypeScript: 0 errors in new files (59 pre-existing errors unchanged)
