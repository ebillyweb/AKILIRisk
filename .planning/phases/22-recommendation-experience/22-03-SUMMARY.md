---
phase: 22-recommendation-experience
plan: "03"
subsystem: guidance-server-actions
tags: [server-actions, zod, ownership-validation, override-policy, lifecycle, tests]
dependency_graph:
  requires: [recommendation-lifecycle-schema, override-policy]
  provides: [guidance-actions, enterprise-overlay-actions, client-action-plan-actions]
  affects: [src/lib/recommendations/solution-lifecycle.ts]
tech_stack:
  added: []
  patterns: [ownership-verified-mutations, bulk-transaction-atomicity, dual-track-status]
key_files:
  created:
    - src/lib/actions/guidance-schemas.ts
    - src/lib/actions/guidance-actions.ts
    - src/lib/actions/enterprise-solution-actions.ts
    - src/lib/actions/client-action-plan-actions.ts
    - src/lib/actions/guidance-actions.test.ts
    - src/lib/actions/enterprise-solution-actions.test.ts
    - src/lib/actions/client-action-plan-actions.test.ts
  modified:
    - src/lib/recommendations/solution-lifecycle.ts
decisions:
  - "Extended solution-lifecycle.ts state machine and transition function inline (Rule 3) rather than waiting for Plan 02"
  - "INCLUDED status reuses ACCEPTED timestamp/milestone hydration semantics"
  - "IN_PROGRESS sets startedAt timestamp for implementation tracking"
metrics:
  duration: "469s"
  completed: "2026-06-27T05:25:17Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 16
  files_created: 7
  files_modified: 1
---

# Phase 22 Plan 03: Guidance Server Actions Summary

Three-role server actions for advisor guidance review (11 actions), enterprise overlay CRUD with override policy enforcement, and client task status updates with session-based auth -- all ownership-validated and tested with 16 unit tests.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create Zod validation schemas | 1a6c2e2 | src/lib/actions/guidance-schemas.ts |
| 2 | Create server actions and tests | 7c2da53 | src/lib/actions/guidance-actions.ts, enterprise-solution-actions.ts, client-action-plan-actions.ts, solution-lifecycle.ts, 3 test files |

## What Was Built

**Zod schemas (guidance-schemas.ts):** 12 validation schemas shared across three action files -- advisor schemas (include, defer, bulkDefer, hide, adjustPriority, updateNotes, validationStatus, updateTimeHorizon, updateRoles, updateAssignees), enterprise overlay schema, client task status schema.

**Advisor guidance actions (guidance-actions.ts):** 11 server actions with `requireAdvisorRole()` auth and ownership verification via `verifyAdvisorOwnsRecommendation` (joins AssessmentRecommendation -> Assessment -> ClientAdvisorAssignment). Bulk operations (includeInActionPlan, bulkDefer) use `prisma.$transaction` for atomicity per Pitfall 4. Lifecycle transitions delegate to `transitionRecommendationStatus`. Direct field updates (hide, priority, notes, validation, timeHorizon, roles, assignees) use Prisma with SolutionActivity audit logging where applicable. Notes updates intentionally skip audit logging (editorial, not lifecycle events).

**Enterprise overlay actions (enterprise-solution-actions.ts):** `upsertEnterpriseOverlay` enforces override policy via `validateOverlayFields()` before writing -- rejects PROTECTED field mutations (T-22-06). All queries scoped to `team.enterpriseId`. `getEnterpriseOverlays` returns overlays with service recommendation context.

**Client action plan actions (client-action-plan-actions.ts):** `updateTaskStatus` uses `auth()` session and verifies `assessment.userId === session.user.id` (T-22-07). Creates `validation_requested` activity when COMPLETED + requiresValidation. `getClientActionPlan` returns INCLUDED/IN_PROGRESS/COMPLETED recommendations grouped by timeHorizon (immediate/strategic/ongoing), excluding hiddenFromClient items. validationStatus mutations not exposed (T-22-09).

**Solution lifecycle extension (solution-lifecycle.ts):** Extended ALLOWED_TRANSITIONS to include GENERATED, INCLUDED, DEFERRED, IN_PROGRESS states. Added defer-specific fields (deferredRevisitDate, deferredTriggerEvent) to transition function. INCLUDED shares ACCEPTED semantics for milestone hydration and source layer persistence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] State machine missing new lifecycle states**
- **Found during:** Task 2
- **Issue:** `solution-lifecycle.ts` ALLOWED_TRANSITIONS only had PENDING/REVIEWED/ACCEPTED/DECLINED/COMPLETED. Plan 03 actions needed INCLUDED and DEFERRED transitions, plus defer-specific fields in the transition function.
- **Fix:** Extended ALLOWED_TRANSITIONS with Phase 22 states (GENERATED, INCLUDED, DEFERRED, IN_PROGRESS). Added SOLUTION_ACTIONS and STATUS_ACTION_MAP entries for new states. Extended `transitionRecommendationStatus` input to accept `deferredRevisitDate` and `deferredTriggerEvent`. Added switch cases for INCLUDED (sets acceptedAt), DEFERRED (sets defer fields), and IN_PROGRESS (sets startedAt).
- **Files modified:** src/lib/recommendations/solution-lifecycle.ts
- **Commit:** 7c2da53

## Self-Check: PASSED
