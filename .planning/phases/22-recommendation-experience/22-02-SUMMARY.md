---
phase: 22-recommendation-experience
plan: "02"
subsystem: recommendation-lifecycle
tags: [lifecycle, state-machine, guidance-package, dedup, composition]
dependency_graph:
  requires: [recommendation-lifecycle-schema, asset-catalog-engine, override-policy, guidance-package-types]
  provides: [extended-lifecycle-transitions, guidance-package-query, cross-assessment-dedup, policy-aware-composition]
  affects: [src/lib/recommendations/solution-lifecycle.ts, src/lib/recommendations/compose-solution.ts]
tech_stack:
  added: []
  patterns: [cross-assessment-dedup, batch-overlay-fetch, policy-aware-composition]
key_files:
  created:
    - src/lib/recommendations/guidance-package.ts
    - src/lib/recommendations/guidance-package.test.ts
  modified:
    - src/lib/recommendations/solution-lifecycle.ts
    - src/lib/recommendations/solution-lifecycle.test.ts
    - src/lib/recommendations/compose-solution.ts
decisions:
  - "INCLUDED mirrors ACCEPTED behavior (compose + milestones) for backward compat with downstream code"
  - "deferredAt tracked via statusUpdatedAt since no separate column exists in schema"
  - "Evidence merging handles three triggerReason formats: array, object-with-reasons, and plain value"
metrics:
  duration: "316s"
  completed: "2026-06-27T05:22:16Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 20
  files_created: 2
  files_modified: 3
---

# Phase 22 Plan 02: Lifecycle Extension & Guidance Package Summary

Extended lifecycle state machine with GENERATED/INCLUDED/DEFERRED/IN_PROGRESS transitions and built per-client guidance package aggregation with cross-assessment deduplication by serviceRecommendationId, keeping highest urgency and merging evidence arrays.

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extend lifecycle state machine | c194ef0 | src/lib/recommendations/solution-lifecycle.ts, solution-lifecycle.test.ts |
| 2 | Guidance package with dedup | 95ca39e | src/lib/recommendations/guidance-package.ts, guidance-package.test.ts, compose-solution.ts |

## What Was Built

**Lifecycle state machine extension:** ALLOWED_TRANSITIONS expanded from 5 to 9 states with backward-compatible PENDING/ACCEPTED paths. New transitions: GENERATED->REVIEWED, REVIEWED->INCLUDED/DEFERRED, INCLUDED->IN_PROGRESS, IN_PROGRESS->COMPLETED, DEFERRED->REVIEWED. INCLUDED mirrors ACCEPTED behavior (solution composition + milestone hydration). DEFERRED stores reason, optional revisitDate, and optional triggerEvent. IN_PROGRESS sets startedAt timestamp. Four new SOLUTION_ACTIONS constants added.

**Guidance package aggregation:** `getGuidancePackageForClient()` queries all completed assessments for a client, deduplicates recommendations by serviceRecommendationId (keeping highest urgencyScore, merging triggerReason arrays), batch-fetches overlays with `{ in: serviceIds }` pattern, composes each with override policy enforcement via the inheritance engine, and builds GuidancePackageItem array with summary counts.

**Composition engine extension:** `composeSolution()` accepts optional `overridePolicies` parameter. When provided, delegates scalar override resolution to `composeAsset()` from the inheritance engine. When absent, uses existing last-writer-wins behavior (zero breaking changes).

**Pure dedup function:** `deduplicateRecommendations()` exported separately for testability. Handles array, object-with-reasons, and plain-value triggerReason formats. Null urgencyScore treated as 0.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
