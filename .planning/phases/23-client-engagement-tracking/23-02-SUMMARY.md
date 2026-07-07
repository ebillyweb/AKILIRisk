---
phase: 23-client-engagement-tracking
plan: "02"
subsystem: engagement-services
tags: [feature-flags, activity-feed, publish-action-plan, server-only]
dependency_graph:
  requires: [23-01]
  provides: [isImplementationTrackingEnabled, isTrackingActiveForAssessment, getClientActivityFeed, publishActionPlan, ActivityFeedItem]
  affects: [engagement-actions, strategic-action-plan-ui]
tech_stack:
  added: []
  patterns: [server-only-module, prisma-transaction, role-filtered-query]
key_files:
  created:
    - src/lib/engagement/feature-flags.ts
    - src/lib/engagement/activity-feed.ts
    - src/lib/engagement/publish-action-plan.ts
    - src/lib/engagement/feature-flags.test.ts
    - src/lib/engagement/activity-feed.test.ts
  modified: []
decisions:
  - "Solo advisors (no enterprise) default to tracking enabled"
  - "CLIENT role excludes advisor-internal action types from activity feed"
  - "Publish is idempotent -- throws on double-publish rather than silently succeeding"
metrics:
  duration: "~3 minutes"
  completed: "2026-06-27"
  tasks_completed: 2
  tasks_total: 2
  test_count: 15
  test_pass: 15
---

# Phase 23 Plan 02: Core Backend Services Summary

Three server-only service modules for enterprise feature flag check, client-scoped activity feed query, and transactional action plan publish mechanism.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Feature flag helper and activity feed query | 13a71d3 | feature-flags.ts, activity-feed.ts, +tests |
| 2 | Publish action plan service | 1506fed | publish-action-plan.ts |

## What Was Built

**feature-flags.ts** -- Two helpers: `isImplementationTrackingEnabled(advisorProfileId)` queries AdvisorEnterprise flag with solo advisor default (true), `isTrackingActiveForAssessment(assessmentId)` checks actionPlanPublishedAt presence.

**activity-feed.ts** -- `getClientActivityFeed({ clientId, limit, offset, role })` returns paginated ActivityFeedItem array. Joins SolutionActivity through AssessmentRecommendation to Assessment.userId. CLIENT role filters to 7 whitelisted action types, excluding advisor-internal actions like status_reviewed.

**publish-action-plan.ts** -- `publishActionPlan({ assessmentId, actorId })` uses prisma.$transaction to atomically set actionPlanPublishedAt and create SolutionActivity entries for all client-visible recommendations. Guards against double-publish and non-COMPLETED assessments.

## Deviations from Plan

None -- plan executed exactly as written.

## Notes

All three modules import `server-only` (not `"use server"`) since they are service-layer utilities, not server actions. The server action controller layer (Plan 03) will import these modules.

Schema fields referenced (actionPlanPublishedAt, implementationTrackingEnabled, SolutionActivity, hiddenFromClient) are created by Plan 01 in the same wave. TypeScript compilation will succeed after both worktrees merge and `prisma generate` runs.

## Self-Check: PASSED
