---
phase: 25-executive-reporting
plan: "02"
subsystem: executive-reporting
tags: [pdf, react-pdf, executive-report, advisor-brief, api-route, phase-25]
dependency_graph:
  requires:
    - "25-01: ExecutiveReportSnapshot types + buildExecutiveReportSnapshot"
    - "pdf/branding-integration: createBrandedPDFMetadata, getAdvisorBrandingForPDF"
    - "pdf/components: EnhancedReportCover, EnhancedPageFooter, DraftWatermark (reused)"
  provides:
    - "renderExecutiveReportPdf(): pure render function (snapshot + branding + variant -> PDF bytes)"
    - "ExecutiveReportDocument: top-level PDF Document with 8 sections + advisor brief pages"
    - "GET /api/reports/executive/[reportId]/pdf: auth-gated PDF delivery route"
  affects:
    - src/lib/pdf/executive-styles.ts
    - src/lib/pdf/render-executive-report.tsx
    - src/lib/pdf/components/ExecutiveReport.tsx
    - src/lib/pdf/components/ExecutiveReadinessPage.tsx
    - src/lib/pdf/components/OverallRiskProfilePage.tsx
    - src/lib/pdf/components/ScoreDeltaPage.tsx
    - src/lib/pdf/components/ImplementationProgressPage.tsx
    - src/lib/pdf/components/TopPrioritiesPage.tsx
    - src/lib/pdf/components/AdvisorRecommendationsPage.tsx
    - src/lib/pdf/components/NextStepsPage.tsx
    - src/lib/pdf/components/AdvisorBriefPages.tsx
    - src/app/api/reports/executive/[reportId]/pdf/route.tsx
tech_stack:
  added: []
  patterns:
    - "react-pdf View/Text primitives only for all PDF visualizations (D-14)"
    - "Variant prop controls advisor-only page inclusion at Document level, not snapshot field presence (D-17, Pitfall 2)"
    - "Explicit numeric column widths derived from A4 content (451pt) to avoid flex percentage pitfall (Pitfall 6)"
    - "Zero-state messaging for conditional sections instead of empty pages (D-07)"
    - "Three-bucket auth: isOwner || isAdmin || isAssignedAdvisor (mirrors by-id PDF route)"
key_files:
  created:
    - src/lib/pdf/executive-styles.ts
    - src/lib/pdf/render-executive-report.tsx
    - src/lib/pdf/components/ExecutiveReport.tsx
    - src/lib/pdf/components/ExecutiveReadinessPage.tsx
    - src/lib/pdf/components/OverallRiskProfilePage.tsx
    - src/lib/pdf/components/ScoreDeltaPage.tsx
    - src/lib/pdf/components/ImplementationProgressPage.tsx
    - src/lib/pdf/components/TopPrioritiesPage.tsx
    - src/lib/pdf/components/AdvisorRecommendationsPage.tsx
    - src/lib/pdf/components/NextStepsPage.tsx
    - src/lib/pdf/components/AdvisorBriefPages.tsx
    - src/app/api/reports/executive/[reportId]/pdf/route.tsx
  modified: []
decisions:
  - "Reused EnhancedReportCover for executive cover (passes reportType='Executive Risk Report') -- no new cover component needed"
  - "PillarDelta.attribution field used (not attributedRecommendations) -- caught from reassessment-types.ts"
  - "getAdvisorBrandingForPDF from branding-integration used for live branding on DRAFT (matches by-id route pattern)"
  - "renderLiveExecutivePreview accepts branding as parameter (not fetching internally) -- consistent with renderLivePreviewForAssessment pattern"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 12
  files_modified: 0
---

# Phase 25 Plan 02: PDF Rendering Pipeline Summary

Executive Report PDF rendering pipeline: 11 react-pdf components (8 content sections + advisor brief + styles + render function) plus the auth-gated API route serving client-facing and advisor brief variants from frozen or live snapshots.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PDF section components + executive styles + render function | c3daa20 | 11 files (executive-styles.ts, render-executive-report.tsx, 9 section components) |
| 2 | Executive Report PDF API route with auth gating | 0992d1c | src/app/api/reports/executive/[reportId]/pdf/route.tsx |

## What Was Built

### Task 1: PDF Components, Styles, and Render Function

**`src/lib/pdf/executive-styles.ts`**
- StyleSheet.create with executive-specific styles: tier badges (Developing/Mature/Advanced), delta colors (positive/negative/unchanged), progress bar track + fill, impact level badges (Critical/High/Medium/Low), stacked bar for recommendation breakdown, table primitives, advisor brief internal header
- Color helpers: `impactLevelColor()`, `tierBgColor()`, `riskLevelHex()`
- All A4 column widths explicit (451pt content area) -- no percentage widths in nested flex (Pitfall 6)

**`src/lib/pdf/components/ExecutiveReport.tsx`**
- Top-level Document component with `createBrandedPDFMetadata` for PDF metadata
- Section ordering per D-08 narrative arc: cover, readiness, risk profile, delta, priorities, progress, recommendations, next steps
- Variant gate: `variant === "advisor"` renders `AdvisorBriefPages`; client variant never renders advisor-only pages (D-17, Pitfall 2)

**Section components (8 files):**
- `ExecutiveReadinessPage`: tier badge (colored View rectangle per D-10), highest-risk/strongest domains with dot indicators, strategic priorities list
- `OverallRiskProfilePage`: per-pillar table with native View progress bars and risk/impact badges (D-09 -- NO composite score; D-14 -- no SVG)
- `ScoreDeltaPage`: per-pillar previous/current/delta/trend columns with attribution drivers; zero-state when `scoreDelta === null` (D-07, D-12, D-13)
- `ImplementationProgressPage`: large progress bar + metric grid; zero-state when `engagementSummary === null` (D-07)
- `TopPrioritiesPage`: priority table with impact level color badges
- `AdvisorRecommendationsPage`: recommendation count metrics + stacked horizontal View bar breakdown (D-14)
- `NextStepsPage`: numbered action list with reporting period footer (D-24)
- `AdvisorBriefPages`: advisor notes, meeting agenda, discussion prompts across 2 pages; "ADVISOR BRIEF -- INTERNAL USE ONLY" header

**`src/lib/pdf/render-executive-report.tsx`**
- `renderExecutiveReportPdf(input)`: pure render function, mirrors `render-report.tsx` exactly
- `renderLiveExecutivePreview(clientId, advisorProfileId, variant, branding?)`: convenience for DRAFT preview
- No SVG/canvas/chart library imports (D-14)

### Task 2: Executive Report PDF API Route

**`src/app/api/reports/executive/[reportId]/pdf/route.tsx`**

Auth flow (three-bucket, mirrors `by-id/[reportId]/pdf/route.tsx`):
- 401: no session (T-25-06)
- 403: none of isOwner/isAdmin/isAssignedAdvisor (T-25-07 -- advisor must have ACTIVE assignment)
- 403: isOwner + DRAFT (clients never see drafts -- T-25-08, D-21)
- 403: isOwner + `?variant=advisor` (clients cannot access Advisor Brief -- T-25-05, D-17)

Rendering:
- PUBLISHED/SUPERSEDED: parse frozen `executiveSnapshotData` + `brandingSnapshot` from DB
- DRAFT: call `buildExecutiveReportSnapshot` for live data + `getAdvisorBrandingForPDF` for live branding; overlay editorial fields (`advisorNotes`, `meetingAgenda`, `discussionPrompts`) from DB row onto snapshot
- Content-Disposition distinguishes `executive-report` vs `advisor-brief` in filename

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PillarDelta field name was `attribution` not `attributedRecommendations`**
- **Found during:** Task 1 implementation of ScoreDeltaPage
- **Issue:** Plan spec referenced `delta.attributedRecommendations` but the actual `PillarDelta` type in `src/lib/assessment/reassessment-types.ts` uses `attribution: string[]`
- **Fix:** Changed ScoreDeltaPage to reference `delta.attribution`
- **Files modified:** `src/lib/pdf/components/ScoreDeltaPage.tsx`
- **Commit:** c3daa20

**2. [Rule 2 - Missing Critical] renderLiveExecutivePreview accepts branding as parameter**
- **Found during:** Task 1 render function design
- **Issue:** Plan spec said "calls buildExecutiveReportSnapshot then renderExecutiveReportPdf" but did not specify branding source. Fetching branding inside the function would require an additional Prisma query and couples the render function to the DB.
- **Fix:** Added `branding` as an optional parameter (defaults to null) -- matches pattern from `renderLivePreviewForAssessment` which also takes branding externally
- **Files modified:** `src/lib/pdf/render-executive-report.tsx`
- **Commit:** c3daa20

## Known Stubs

None. All fields render live data from the snapshot. Zero-state messaging covers conditional sections per D-07.

## Threat Flags

No new threat surface beyond the plan's threat model. All five threats (T-25-04 through T-25-08) are mitigated in the route implementation.

## Self-Check: PASSED

- FOUND: src/lib/pdf/executive-styles.ts
- FOUND: src/lib/pdf/render-executive-report.tsx
- FOUND: src/lib/pdf/components/ExecutiveReport.tsx
- FOUND: src/lib/pdf/components/ExecutiveReadinessPage.tsx
- FOUND: src/lib/pdf/components/OverallRiskProfilePage.tsx
- FOUND: src/lib/pdf/components/ScoreDeltaPage.tsx
- FOUND: src/lib/pdf/components/ImplementationProgressPage.tsx
- FOUND: src/lib/pdf/components/TopPrioritiesPage.tsx
- FOUND: src/lib/pdf/components/AdvisorRecommendationsPage.tsx
- FOUND: src/lib/pdf/components/NextStepsPage.tsx
- FOUND: src/lib/pdf/components/AdvisorBriefPages.tsx
- FOUND: src/app/api/reports/executive/[reportId]/pdf/route.tsx
- FOUND commit: c3daa20 (Task 1)
- FOUND commit: 0992d1c (Task 2)
- TypeScript: 0 errors in new files (59 pre-existing errors unchanged)
