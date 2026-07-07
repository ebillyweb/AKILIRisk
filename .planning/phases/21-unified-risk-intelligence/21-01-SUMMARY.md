---
phase: 21-unified-risk-intelligence
plan: "01"
subsystem: assessment
tags: [recommendation-engine, pillar-rules, seed-script, test-fixtures]

requires: []
provides:
  - "ServiceRecommendation seed entries for liquidity-cash, tax-exposure, estate-succession, family-governance-behavioral (12 new services)"
  - "LEGACY_RECOMMENDATION_RULES for all 4 new pillars in setup-all-pillar-rules.ts (12 new rules)"
  - "UI recommendation rules for 4 new pillars keyed to Belvedere question IDs (12 rules)"
  - "BELVEDERE_TEST_QUESTION_IDS entries for all 4 new pillars (12 keys: liqA1-3, taxA1-3, estA1-3, behA1-3)"
  - "Updated recommendation-catalog-fixtures.ts covering all 10 pillars"
affects:
  - "21-02 (advisor customization uses same service IDs)"
  - "21-03 (recommendation display pulls from expanded service catalog)"

tech-stack:
  added: []
  patterns:
    - "New pillar services follow category='financial'/'legal'/'advisory' pattern (distinct from existing 'governance'/'security'/'insurance'/'reputation')"
    - "Each pillar has 3 services (priority 1/2/3) + 3 legacy rules + 3 UI rules keyed to Belvedere test question IDs"
    - "Catalog fixtures mirror setup script: new legacy rules added to both LEGACY_RECOMMENDATION_RULES in setup script AND LEGACY_CATALOG_RULES in catalog fixtures"

key-files:
  created: []
  modified:
    - "scripts/setup-all-pillar-rules.ts - 12 new ServiceRecommendation entries + 12 new LEGACY_RECOMMENDATION_RULES"
    - "src/lib/assessment/test-fixtures/belvedere-pillar-questions.ts - 12 new BELVEDERE_TEST_QUESTION_IDS + 4 CATEGORY_CODE entries + 12 BELVEDERE_ROWS"
    - "src/lib/assessment/engines/family-governance-recommendation-rules.ts - 12 new UI rules + 12 new FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS"
    - "src/lib/assessment/engines/recommendation-catalog-fixtures.ts - 12 new CatalogService, 12 legacy rules, updated HIGH_RISK_FAMILY_ANSWERS/LOW_RISK/PILLAR_SCORES/EXPECTED_SERVICE_IDS"

key-decisions:
  - "Added 12 legacy rules to both setup-all-pillar-rules.ts (for DB seeding) AND recommendation-catalog-fixtures.ts (for unit test mocks) — both must stay in sync"
  - "New pillar categories: financial (liquidity, tax), legal (estate), advisory (behavioral) — distinct from existing governance/security/insurance/reputation"
  - "HIGH_RISK_FAMILY_ANSWERS uses legacy question IDs (liquidity_cash_reserves etc.) matching legacy rules; UI rules use Belvedere IDs (Q.liqA1 etc.) from test fixtures"

patterns-established:
  - "Dual registration pattern: new pillar rules must be added to setup script (DB) AND catalog fixtures (test mocks)"
  - "3-rule pillar pattern: priority-1 rule uses answer_match + score_threshold; priority-2 uses answer_match only; priority-3 uses answer_match + score_threshold"

duration: 6min
completed: "2026-06-25"
---

# Phase 21 Plan 01: 10-Pillar Recommendation Coverage Summary

**Full-coverage recommendation rules for all 10 risk pillars: 12 new services, 12 legacy DB rules, 12 UI rules, and 12 Belvedere test question IDs across liquidity-cash, tax-exposure, estate-succession, and family-governance-behavioral**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-25T22:35:58Z
- **Completed:** 2026-06-25T22:42:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added 12 ServiceRecommendation seed entries (3 per new pillar) to `setup-all-pillar-rules.ts` covering financial liquidity, tax, legal estate, and advisory behavioral services
- Added 12 UI recommendation rules to `FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES` keyed to Belvedere test question IDs (Q.liqA1 etc.)
- Updated all test fixtures: BELVEDERE_TEST_QUESTION_IDS (12 new keys), BELVEDERE_ROWS (12 new rows), HIGH_RISK_FAMILY_ANSWERS, LOW_RISK_FAMILY_ANSWERS, HIGH_RISK_PILLAR_SCORES, and HIGH_RISK_EXPECTED_SERVICE_IDS
- All 6 happy-path tests and 5 engine tests pass unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add new pillar services, legacy rules, and test question IDs** - `265d5a7` (feat)
2. **Task 2: Add UI recommendation rules and update catalog fixtures** - `8b0c7dd` (feat)

## Files Created/Modified

- `/Users/bwoodtalton/Projects/AkiliRisk/scripts/setup-all-pillar-rules.ts` - 12 new services + 12 new legacy rules for DB seeding
- `/Users/bwoodtalton/Projects/AkiliRisk/src/lib/assessment/test-fixtures/belvedere-pillar-questions.ts` - 12 new BELVEDERE_TEST_QUESTION_IDS, 4 CATEGORY_CODE entries, 12 BELVEDERE_ROWS
- `/Users/bwoodtalton/Projects/AkiliRisk/src/lib/assessment/engines/family-governance-recommendation-rules.ts` - 12 UI rules + 28-entry FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS
- `/Users/bwoodtalton/Projects/AkiliRisk/src/lib/assessment/engines/recommendation-catalog-fixtures.ts` - 12 CatalogService entries, 12 legacy catalog rules, updated all fixture maps

## Decisions Made

- Added 12 legacy rules to both setup script (DB seeding) AND catalog fixtures (test mocks) — test mocks must mirror DB seed content exactly
- New pillar categories use `financial` (liquidity, tax), `legal` (estate), `advisory` (behavioral) — distinct from existing `governance`/`security`/`insurance`/`reputation`
- Legacy rules use domain-specific answer IDs (e.g., `liquidity_cash_reserves`) while UI rules reference Belvedere question IDs (`Q.liqA1`) — both are needed to cover both code paths

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added 12 legacy catalog rules to recommendation-catalog-fixtures.ts**
- **Found during:** Task 2 (catalog fixtures update)
- **Issue:** Test `HIGH_RISK_FAMILY_ANSWERS` uses legacy-style answer IDs; `PRODUCTION_CATALOG_RULES` is derived from `LEGACY_CATALOG_RULES` + UI rules — without new entries in `LEGACY_CATALOG_RULES`, the high-risk test failed because the engine couldn't match new pillar answers
- **Fix:** Added 12 new `CatalogRule` entries to `LEGACY_CATALOG_RULES` in `recommendation-catalog-fixtures.ts`, mirroring the rules added to `setup-all-pillar-rules.ts`
- **Files modified:** `src/lib/assessment/engines/recommendation-catalog-fixtures.ts`
- **Verification:** All 6 happy-path tests pass after fix
- **Committed in:** `8b0c7dd` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (missing critical — test fixture parity with seed script)
**Impact on plan:** Auto-fix necessary for test correctness. The plan spec called for catalog fixture updates but did not explicitly list adding legacy rules to `LEGACY_CATALOG_RULES`. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviation above.

## User Setup Required

None - no external service configuration required. Run `npm run seed:pillar-ddl` or the setup script after deploying to populate the new service/rule rows in the DB.

## Next Phase Readiness

- All 10 pillars now have ServiceRecommendation and RecommendationRule entries — prerequisite for Plan 02 (advisor customization) and Plan 03 (recommendation display)
- Test coverage confirms engine correctly matches new pillar rules against high-risk answer sets
- Service IDs are stable and ready for advisor AdvisorRecommendationRule references

## Self-Check

Files exist:
- `scripts/setup-all-pillar-rules.ts` - FOUND
- `src/lib/assessment/test-fixtures/belvedere-pillar-questions.ts` - FOUND
- `src/lib/assessment/engines/family-governance-recommendation-rules.ts` - FOUND
- `src/lib/assessment/engines/recommendation-catalog-fixtures.ts` - FOUND

Commits exist:
- `265d5a7` - FOUND
- `8b0c7dd` - FOUND

## Self-Check: PASSED

---
*Phase: 21-unified-risk-intelligence*
*Completed: 2026-06-25*
