---
phase: 24-continuous-risk-improvement
plan: 03
subsystem: api
tags: [server-actions, cron, zod, prisma, activity-feed, reassessment, cadence]

requires:
  - phase: 24-continuous-risk-improvement/01
    provides: reassessment creation service, score delta computation, targeted follow-up
  - phase: 24-continuous-risk-improvement/02
    provides: intelligence event logging, cadence engine, system triggers, feature flags
provides:
  - startReassessmentAction with advisor auth and ownership verification
  - getScoreDeltasAction accessible to both advisor and client (D-07)
  - getTargetedQuestionCountAction for UI badge rendering
  - getReassessmentHistoryAction for version chain display
  - setCadenceAction and overrideCadenceAction with assignment verification
  - getCadenceAction for cadence status queries
  - Review cadence cron route with CRON_SECRET auth and dedup
  - Activity feed evolution with intelligence event support
affects: [24-continuous-risk-improvement/04]

tech-stack:
  added: []
  patterns: [dual-role server action access (advisor+client), OR-condition Prisma query for nullable FK]

key-files:
  created:
    - src/lib/actions/reassessment-actions.ts
    - src/lib/actions/cadence-actions.ts
    - src/app/api/cron/review-cadence/route.ts
  modified:
    - src/lib/engagement/activity-feed.ts

key-decisions:
  - "verifyAssessmentAccess helper supports both advisor (via assignment) and client (via userId match) for D-07 dual-role access"
  - "Cadence actions look up advisorProfileId from userId via prisma.advisorProfile.findUnique to bridge auth identity to cadence domain"
  - "Activity feed uses OR condition to merge recommendation-based and intelligence events in single query"
  - "ActivityFeedItem.eventType discriminator (recommendation|intelligence) added for UI rendering distinction"

patterns-established:
  - "Dual-role server action: auth() for both advisor and client, role-based access check in shared verifyAssessmentAccess"
  - "Cron cadence processing: overdue/due-soon split with dedup via lastReminderSentAt, system trigger check in same pass"

requirements-completed: [LIFECYCLE-03]

duration: 12min
completed: 2026-06-28
---

# Phase 24 Plan 03: Server Actions, Cron Route, and Activity Feed Summary

**Reassessment and cadence server actions with Zod validation, CRON_SECRET-auth'd cadence processor, and activity feed evolution for intelligence events**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 1

## Accomplishments
- Reassessment server actions (start, score deltas, targeted count, history) with role guards and ownership verification
- Cadence server actions (set, override, get) with advisor-client assignment enforcement and feature flag check
- Review cadence cron route processing overdue/due-soon cadences with dedup and system trigger evaluation
- Activity feed evolved to handle nullable assessmentRecommendationId via OR query, merging intelligence events

## Task Commits

1. **Task 1: Reassessment and cadence server actions** - `897a700` (feat)
2. **Task 2: Cron route and activity feed evolution** - `c98a316` (feat)

## Files Created/Modified
- `src/lib/actions/reassessment-actions.ts` - Server actions for reassessment flow (start, deltas, count, history)
- `src/lib/actions/cadence-actions.ts` - Server actions for cadence management (set, override, get)
- `src/app/api/cron/review-cadence/route.ts` - Daily cron route for cadence processing with CRON_SECRET auth
- `src/lib/engagement/activity-feed.ts` - Updated to support intelligence events via OR query and eventType discriminator

## Decisions Made
- verifyAssessmentAccess supports dual-role access: advisor checks assignment, client checks userId match (D-07)
- Cadence actions compute nextDueDate from latest completed assessment; fall back to now() if no assessment exists
- Activity feed INTELLIGENCE_ACTION_LABELS map provides human-readable names when no recommendation exists
- ActivityFeedItem.recommendationId changed to `string | null` for intelligence events (backward compatible)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed advisorProfileId field name in cadence assignment query**
- **Found during:** Task 1 (cadence-actions.ts)
- **Issue:** Used `advisorProfileId` in ClientAdvisorAssignment where clause but the FK field is `advisorId`
- **Fix:** Changed to `advisorId: profile.id` matching the Prisma schema
- **Verification:** `npx tsc --noEmit` passes with no errors in our files
- **Committed in:** 897a700 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All server actions and cron route ready for Plan 04 (UI components)
- Activity feed API returns both recommendation and intelligence events with eventType discriminator
- Plan 04 can call startReassessmentAction, getScoreDeltasAction, cadence actions directly

---
*Phase: 24-continuous-risk-improvement*
*Completed: 2026-06-28*
