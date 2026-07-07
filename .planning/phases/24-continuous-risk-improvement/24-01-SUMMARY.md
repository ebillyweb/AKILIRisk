---
phase: 24-continuous-risk-improvement
plan: 01
subsystem: database, api
tags: [prisma, assessment, reassessment, score-delta, review-cadence, vitest]

requires:
  - phase: 23-client-engagement-tracking
    provides: SolutionActivity model, activity feed, engagement metrics
provides:
  - Assessment.previousAssessmentId self-referential FK for reassessment chaining
  - Nullable SolutionActivity.assessmentRecommendationId + new assessmentId FK
  - ReviewCadence model with CadenceFrequency enum
  - AdvisorEnterprise.defaultCadenceFrequency field
  - ReassessmentType, PillarDelta, ReassessmentInput shared types
  - createReassessment service with chain-length version derivation
  - getReassessmentChain and getLatestCompletedAssessment queries
  - computePillarDeltas pure function with attribution
  - getScoreDeltasForAssessment server-side delta computation
  - getTargetedFollowupQuestions and getTargetedQuestionCount services
affects: [24-02, 24-03, 24-04, 25-executive-reporting]

tech-stack:
  added: []
  patterns:
    - "Self-referential FK chain for assessment versioning (previousAssessmentId)"
    - "Pure function delta computation (computePillarDeltas) decoupled from DB access"
    - "Chain-length version derivation (walk previousAssessmentId chain, not version field)"
    - "Nullable FK evolution via ALTER COLUMN DROP NOT NULL (non-destructive)"

key-files:
  created:
    - prisma/migrations/20260628120000_reassessment_versioning/migration.sql
    - src/lib/assessment/reassessment-types.ts
    - src/lib/assessment/reassessment.ts
    - src/lib/assessment/reassessment.test.ts
    - src/lib/analytics/score-delta.ts
    - src/lib/analytics/score-delta.test.ts
    - src/lib/assessment/targeted-followup.ts
    - src/lib/assessment/targeted-followup.test.ts
  modified:
    - prisma/schema.prisma
    - prisma/migrations/20260625120000_subscription_tier_modular_rename/migration.sql

key-decisions:
  - "Version derived from chain length, not Assessment.version field (rescore counter)"
  - "SolutionActivity FK made nullable via ALTER COLUMN, not destructive recreate"
  - "computePillarDeltas is pure function receiving pre-fetched data"

patterns-established:
  - "Assessment chain versioning: walk previousAssessmentId to derive sequence number"
  - "Score delta as pure function: computePillarDeltas(prev, curr, recs) -> PillarDelta[]"

requirements-completed: []

duration: 8min
completed: 2026-06-28
---

# Phase 24 Plan 01: Schema + Types + Core Services Summary

**Assessment versioning schema (previousAssessmentId chain), SolutionActivity nullable FK evolution, ReviewCadence model, reassessment creation service, pure-function score delta computation, and targeted follow-up question extraction -- all with 28 passing tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-28T00:30:09Z
- **Completed:** 2026-06-28T00:37:45Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Prisma migration applied: Assessment.previousAssessmentId self-ref FK, SolutionActivity nullable FK + assessmentId, ReviewCadence model, CadenceFrequency enum, AdvisorEnterprise.defaultCadenceFrequency
- createReassessment service with $transaction and chain-length version derivation (not version field per Pitfall 2)
- computePillarDeltas pure function with direction thresholds (0.01), 2-decimal rounding, and "No new planning activity" attribution (D-06)
- getTargetedFollowupQuestions extracting questionIds from answer_match and missing_control conditions with deduplication

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration** - `ae0a623` (feat)
2. **Task 2: Core types and reassessment creation service** - `4ceb691` (feat)
3. **Task 3: Score delta computation and targeted follow-up** - `0889f44` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Assessment.previousAssessmentId, SolutionActivity nullable FK + assessmentId, ReviewCadence model, CadenceFrequency enum, AdvisorEnterprise.defaultCadenceFrequency
- `prisma/migrations/20260628120000_reassessment_versioning/migration.sql` - Migration SQL with ALTER COLUMN DROP NOT NULL
- `src/lib/assessment/reassessment-types.ts` - ReassessmentType, PillarDelta, ReassessmentInput, ReassessmentChainEntry
- `src/lib/assessment/reassessment.ts` - createReassessment, getReassessmentChain, getLatestCompletedAssessment
- `src/lib/assessment/reassessment.test.ts` - 9 tests for reassessment creation
- `src/lib/analytics/score-delta.ts` - computePillarDeltas (pure), getScoreDeltasForAssessment (server)
- `src/lib/analytics/score-delta.test.ts` - 10 tests for delta computation
- `src/lib/assessment/targeted-followup.ts` - getTargetedFollowupQuestions, getTargetedQuestionCount
- `src/lib/assessment/targeted-followup.test.ts` - 9 tests for targeted follow-up
- `prisma/migrations/20260625120000_subscription_tier_modular_rename/migration.sql` - Fixed idempotency for shadow DB replays

## Decisions Made
- Assessment.version kept as rescore counter; reassessment version derived from previousAssessmentId chain length (Pitfall 2)
- SolutionActivity FK made nullable via ALTER COLUMN DROP NOT NULL, not destructive recreate (D-11, Pitfall 1)
- computePillarDeltas is a pure function with no DB access; getScoreDeltasForAssessment handles the server-side data loading
- Direction thresholds: delta > 0.01 = improved, delta < -0.01 = regressed, else unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-existing migration idempotency issue**
- **Found during:** Task 1 (Schema migration)
- **Issue:** 20260625120000_subscription_tier_modular_rename migration failed on shadow DB because enum label "BUSINESS" already existed (non-idempotent RENAME VALUE)
- **Fix:** Wrapped all RENAME VALUE / ADD VALUE statements in DO blocks with pg_enum existence checks
- **Files modified:** prisma/migrations/20260625120000_subscription_tier_modular_rename/migration.sql
- **Verification:** prisma migrate deploy succeeded
- **Committed in:** ae0a623 (Task 1 commit)

**2. [Rule 3 - Blocking] Resolved pre-existing P3018 migration drift**
- **Found during:** Task 1 (Schema migration)
- **Issue:** 20260614120000_intake_text_response migration failed because column already existed in DB (drift)
- **Fix:** Marked as rolled-back then applied via prisma migrate resolve
- **Files modified:** None (migration table state only)
- **Verification:** prisma migrate deploy applied reassessment_versioning cleanly

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to unblock migration creation. No scope creep.

## Issues Encountered
None beyond the migration issues documented as deviations.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete for Plans 02-04
- Types, services, and tests ready for server actions (Plan 03) and UI (Plan 04)
- Plan 02 can build on these: intelligence event constants, cadence engine, system triggers

## Self-Check: PASSED

All 8 created files verified on disk. All 3 task commits (ae0a623, 4ceb691, 0889f44) verified in git log. 28/28 tests passing.

---
*Phase: 24-continuous-risk-improvement*
*Completed: 2026-06-28*
