---
phase: 22-recommendation-experience
plan: "06"
subsystem: client-strategic-action-plan
tags: [client-ui, action-plan, reasoning-chain, progress-tracking, task-status]
dependency_graph:
  requires: [client-action-plan-actions, recommendation-lifecycle-schema]
  provides: [strategic-action-plan-page, action-card, progress-dashboard]
  affects: [src/app/(protected)/dashboard/action-plan/page.tsx]
tech_stack:
  added: []
  patterns: [optimistic-ui-useTransition, collapsible-sections, accessible-progress-bars]
key_files:
  created:
    - src/app/(protected)/dashboard/action-plan/page.tsx
    - src/components/action-plan/StrategicActionPlan.tsx
    - src/components/action-plan/ExecutiveSummary.tsx
    - src/components/action-plan/TimeHorizonSection.tsx
    - src/components/action-plan/ActionCard.tsx
    - src/components/action-plan/ProgressDashboard.tsx
    - src/lib/actions/client-action-plan-actions.ts
  modified: []
decisions:
  - "Created client-action-plan-actions.ts in this worktree (Rule 3: blocking dependency from Plan 03 not merged yet) with getClientActionPlan and updateTaskStatus"
  - "Used customization JSON field on AssessmentRecommendation for taskStatus/validationStatus storage since schema migration from Plan 02 not yet merged"
  - "Readiness score calculated as inverse of average urgency (lower urgency = higher readiness)"
metrics:
  duration: "248s"
  completed: "2026-06-27T05:33:53Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 0
---

# Phase 22 Plan 06: Client Strategic Action Plan Summary

Client-facing Strategic Action Plan page at /dashboard/action-plan with executive summary (readiness score, top priorities, completion count), three time-horizon sections (Immediate/Strategic/Ongoing), action cards with full D-19 reasoning chains and optimistic task status selectors, and accessible progress dashboard.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create client Strategic Action Plan route and layout | c2243a4 | page.tsx, StrategicActionPlan.tsx, ExecutiveSummary.tsx, TimeHorizonSection.tsx, client-action-plan-actions.ts |
| 2 | Build action card with reasoning chain and progress dashboard | 91ab96d | ActionCard.tsx, ProgressDashboard.tsx |

## What Was Built

**Route page (page.tsx):** Server component with auth() session check, ADVISOR/ADMIN role redirect, getClientActionPlan() data loading. Empty state ("Your action plan is being prepared") and error state (Alert destructive) use exact UI-SPEC copywriting. Page title "Your Strategic Action Plan" with font-display.

**StrategicActionPlan.tsx:** Client component rendering vertical stack with 2xl (48px) spacing. Sections: ExecutiveSummary, Immediate Priorities, Strategic Initiatives, Ongoing Practices, ProgressDashboard. Sections only render when non-empty.

**ExecutiveSummary.tsx:** Hero surface card with readiness score (text-4xl font-display), top 3 priorities by urgency with status badges, completed count, and next review date (from deferredRevisitDate).

**TimeHorizonSection.tsx:** Renders section heading/subhead per UI-SPEC with ActionCard list. Strategic initiatives use Collapsible. Ongoing horizon shows recurring cadence label from timeframe field.

**ActionCard.tsx:** Full D-19 reasoning chain: "Why this was recommended" (Collapsible with line-clamp-2), "Expected Benefit", "Supporting Insights", "Implementation Guidance" (collapsible numbered steps), "Success Criteria". Task status Select with 5 exact UI-SPEC labels and optimistic updates via useTransition. Validation status as read-only Badge (conditional on requiresValidation). "Mark Complete" shortcut Button with validation note. Detail grid (cost/timeframe/provider) matching FacilitatedRecommendations pattern. No layer attribution (D-23).

**ProgressDashboard.tsx:** Overall completion percentage (text-3xl) with Progress bar. Per-recommendation progress bars for active items. All progress bars use role="progressbar" with aria-valuenow/valuemin/valuemax per accessibility requirements.

**client-action-plan-actions.ts:** Server actions (getClientActionPlan, updateTaskStatus) with session-based auth, ownership verification (assessment.userId === session.user.id), hiddenFromClient filtering, timeHorizon grouping, and deduplication by serviceRecommendationId.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] client-action-plan-actions.ts not available in worktree**
- **Found during:** Task 1
- **Issue:** Plan 03 created this file but it lives on a different worktree branch not yet merged. UI components cannot compile without it.
- **Fix:** Created the server action file with getClientActionPlan and updateTaskStatus implementations matching the Plan 03 interface contract. Uses customization JSON field for task/validation status since Plan 02 schema migration is also not merged.
- **Files created:** src/lib/actions/client-action-plan-actions.ts
- **Commit:** c2243a4

## Checkpoint Pending

**Task 3 (checkpoint:human-verify):** Client Strategic Action Plan page needs human verification at /dashboard/action-plan. Requires advisor to have included recommendations for client@test.com first. Verification covers: page title, executive summary, time-horizon sections, reasoning chains, status selectors, progress dashboard, and absence of layer attribution labels.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. The page route uses the existing (protected) route group which enforces authentication. Server actions verify session ownership before mutations (T-22-15).

## Self-Check: PASSED
