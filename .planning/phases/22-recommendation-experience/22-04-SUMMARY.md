---
phase: 22-recommendation-experience
plan: "04"
subsystem: advisor-guidance-review-ui
tags: [guidance-review, advisor-ui, recommendation-cards, bulk-actions, tabs]
dependency_graph:
  requires: [guidance-package-query, guidance-actions, lifecycle-transitions]
  provides: [advisor-guidance-review-page, recommendation-card, defer-dialog, bulk-action-bar]
  affects: [src/app/(protected)/advisor/clients/[clientId]/guidance/]
tech_stack:
  added: [shadcn-accordion, shadcn-sheet]
  patterns: [tabbed-review-layout, optimistic-status-transitions, bulk-selection-bar]
key_files:
  created:
    - src/app/(protected)/advisor/clients/[clientId]/guidance/page.tsx
    - src/components/guidance/GuidanceReviewPage.tsx
    - src/components/guidance/ProfileInsightsSection.tsx
    - src/components/guidance/AttentionItemsSection.tsx
    - src/components/guidance/GuidanceSummaryStrip.tsx
    - src/components/guidance/RecommendationCard.tsx
    - src/components/guidance/EvidenceAccordion.tsx
    - src/components/guidance/DeferDialog.tsx
    - src/components/guidance/BulkActionBar.tsx
    - src/components/ui/accordion.tsx
    - src/components/ui/sheet.tsx
  modified: []
decisions:
  - "Evidence section embedded within each RecommendationCard via EvidenceAccordion rather than as a separate tab"
  - "Priority resolved from advisorPriority if set, otherwise derived from numeric priority field"
  - "Attention items matched by keyword search on category/name/description rather than enum tags"
metrics:
  duration: "331s"
  completed: "2026-06-27T05:34:53Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 11
  files_modified: 0
---

# Phase 22 Plan 04: Advisor Guidance Review Page Summary

Full advisor guidance review page with all six D-03 sections, recommendation cards with include/defer/hide/priority controls, evidence accordion, defer dialog, bulk action bar, and cross-assessment insights panels.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Route page with guidance review layout, Profile Insights, Attention Items | 50f1b99 | page.tsx, GuidanceReviewPage.tsx, ProfileInsightsSection.tsx, AttentionItemsSection.tsx, GuidanceSummaryStrip.tsx |
| 2 | Recommendation card, evidence accordion, defer dialog, bulk actions | 19143f3 | RecommendationCard.tsx, EvidenceAccordion.tsx, DeferDialog.tsx, BulkActionBar.tsx |

## What Was Built

**Route page (server component):** Advisor guidance review at `/advisor/clients/[clientId]/guidance`. Calls `requireAdvisorRole()`, verifies client assignment via `ClientAdvisorAssignment`, loads guidance package via `getGuidancePackageForClient()`. Hero surface follows established pattern with Compass icon, "Client Guidance" kicker, client name as title, and GuidanceSummaryStrip showing status counts.

**GuidanceReviewPage (client component):** Tabbed layout with all six D-03 sections: Executive Summary (summary strip + top priorities list), Profile Insights, Attention Items, Recommended Actions (active items), Future Considerations (deferred items), and Implementation Plan (grouped by timeHorizon). Manages bulk selection state and renders BulkActionBar when items are selected.

**ProfileInsightsSection:** Synthesizes cross-assessment insights grouped by category. Identifies cross-cutting patterns (categories appearing across multiple assessments). Each category shows recommendation count, assessment source badges, and individual insight summaries.

**AttentionItemsSection:** Filters items by family/ownership/governance/succession keyword matching. Groups into four attention domains with clickable items that navigate to the Recommended Actions tab and scroll to the specific card.

**GuidanceSummaryStrip:** Horizontal stats strip showing total, included, deferred, completed, in-progress, and hidden counts -- follows RecommendationsSummaryStrip pattern.

**RecommendationCard:** Full advisor control surface per D-04/D-05. Displays name (text-xl), category, priority badge (High: destructive/10, Medium: trust-accent/15, Low: outline), layer attribution badges with aria-label, status badge with aria-live="polite". Controls: "Include in Action Plan" button, "Defer" button opening DeferDialog, DropdownMenu with "Mark Already Addressed", "Hide from Client" (destructive confirm dialog per UI-SPEC), and "Adjust Priority" submenu. Inline expandable textarea for advisor notes with auto-save on blur. All controls use useTransition for pending states.

**EvidenceAccordion:** Collapsible shadcn Accordion showing merged evidence from assessments. Trigger label shows assessment count. Each evidence item formatted via formatTriggerSummary.

**DeferDialog:** Reason Select from predefined list, optional revisit date, optional trigger event, optional notes textarea. Confirm/cancel buttons per UI-SPEC copywriting. Reusable for both single and bulk defer (accepts bulkCount prop).

**BulkActionBar:** Fixed sticky bottom bar with selection count, "Include All" and "Defer All" buttons, and "Clear" ghost button. Bulk defer opens shared DeferDialog.

## Checkpoint Status

Task 3 (checkpoint:human-verify) is pending human verification. The checkpoint asks the advisor to sign in and verify the full guidance review workflow at `/advisor/clients/[clientId]/guidance`.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
