# Phase 21: Platform Recommendation Engine - Research

**Researched:** 2026-06-25
**Domain:** Recommendation rules, advisor customization, assessment submission pipeline
**Confidence:** HIGH — all findings from direct codebase inspection

## Summary

The RecommendationEngine already works and is pillar-agnostic. It loads rules from the DB (`RecommendationRule` table), evaluates five condition types against a `RecommendationContext`, deduplicates by service ID, and persists to `AssessmentRecommendation`. The advisor customization path also exists end-to-end: `AdvisorRecommendationRule` rows are cloned from platform rules at advisor onboarding, baked into a `MethodologySnapshotBlob.recRules` at assessment intake, and served back via `resolveRecommendationRulesForAssessment` as a `rulesOverride` to the engine. The entire advisor-override flow is wired and exercised by `admin-rescore-actions.ts`.

What is missing is content, not infrastructure. Six pillars (governance, cyber-digital, physical-security, insurance, geographic-environmental, reputational-social) already have seeded `ServiceRecommendation` rows and `RecommendationRule` rows in `scripts/setup-all-pillar-rules.ts`. The four new pillars (liquidity-cash, tax-exposure, estate-succession, family-governance-behavioral) have assessment question starters in `new-pillar-assessment-starter.ts` but zero `ServiceRecommendation` or `RecommendationRule` rows. The test fixture in `belvedere-pillar-questions.ts` also has no rows for these four pillars, so no test coverage exists for them. The enhanced submission route (`/api/assessment/enhanced/submit`) calls `generateRecommendations` without a `rulesOverride`, meaning it bypasses the snapshot and advisor-customization path — it hits the DB rules directly.

**Primary recommendation:** Add `ServiceRecommendation` and `RecommendationRule` seed data for the four missing pillars inside `scripts/setup-all-pillar-rules.ts`, add matching test fixture rows to `belvedere-pillar-questions.ts` and `BELVEDERE_TEST_QUESTION_IDS`, update `FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES` with per-pillar rules referencing those IDs, verify the submission route passes a `rulesOverride` for advisor-snapshot-based assessments, and add integration tests.

## Existing Infrastructure (Do Not Re-implement)

### Core Engine
`src/lib/assessment/engines/recommendation-engine.ts` — `RecommendationEngine` class

- `generateRecommendations(context, rulesOverride?)` — matches + dedupes + persists (top 10)
- `matchAndDedupeRecommendations(context, rulesOverride?)` — match only, no persistence (used by rescore action)
- Five condition types: `score_threshold`, `risk_level`, `answer_match`, `missing_control`, `profile_condition`
- Weighted majority rule: rule matches when `satisfiedWeight / totalWeight > 0.5`
- Dedup by `service.id`, sorted by `priority` descending

### Advisor Override Path
```
intake snapshot written
  → buildAdvisorConfigSnapshot() reads advisorRecommendationRule (isActive=true)
  → recRules baked into MethodologySnapshotBlob
  → resolveRecommendationRulesForAssessment(assessmentId) returns those rules
  → passed as rulesOverride to matchAndDedupeRecommendations()
```

`src/lib/methodology/assessment-runtime.ts:resolveRecommendationRulesForAssessment` — wired and working.

`src/lib/methodology/clone-advisor-defaults.ts:cloneAllPlatformRecommendationRules` — clones all active `RecommendationRule` rows to `AdvisorRecommendationRule` on first advisor login.

`src/lib/methodology/clone-advisor-defaults.ts:syncMissingPlatformRecommendationRules` — backfills new platform rules to existing advisors.

### DB Schema (confirmed in schema.prisma)
- `RecommendationRule` — platform rules (`serviceRecommendationId`, `triggerConditions` JSON, `priority`, `isActive`)
- `ServiceRecommendation` — service catalog (`tier: BASELINE|ENHANCED`, `complexity`, `implementationType`)
- `AdvisorRecommendationRule` — per-advisor clone (`sourceKind`, `platformSourceId`, `servicePayload` JSON, `pillarId`)
- `AssessmentRecommendation` — persisted per-assessment output (`unique[assessmentId, serviceRecommendationId]`)

### Validation Schemas
`src/lib/admin/recommendation-rule-schemas.ts` — Zod schemas for all 5 condition types with cross-condition contradiction detection. Use these for any new validation code.

### Seed Script
`scripts/setup-all-pillar-rules.ts` — upserts `ServiceRecommendation` + `RecommendationRule` in a transaction. The place to add the 4 new pillar entries.

## What Exists vs What Is Missing

| Pillar | ServiceRecommendations | RecommendationRules (platform) | UI rules (FAMILY_GOVERNANCE_UI...) | Test fixture rows |
|--------|----------------------|-------------------------------|-------------------------------------|-------------------|
| governance | 3 | 3 legacy | 3 | govA2, govA3, govA5, govA6, govB1, govB4 |
| cyber-digital | 1 (CYBER_SECURITY_UPLIFT_SERVICE) | 0 legacy, 1 UI | 1 | cyberA3, cyberDh01 |
| physical-security | 3 | 3 legacy | 2 | physA1, physB2, physE1 |
| insurance | 3 | 3 legacy | 2 | insEnv04, insHealth04, insMrr01, insMrr03 |
| geographic-environmental | 3 | 3 legacy | 3 | geoEnv01-05 |
| reputational-social | 3 | 3 legacy | 3 | repBs02, repBs04, repBs05 |
| **liquidity-cash** | **0** | **0** | **0** | **0** |
| **tax-exposure** | **0** | **0** | **0** | **0** |
| **estate-succession** | **0** | **0** | **0** | **0** |
| **family-governance-behavioral** | **0** | **0** | **0** | **0** |

The 4 new pillars have assessment question starters (3 questions each) in `new-pillar-assessment-starter.ts` — question IDs are not stable test IDs yet; they must be added to `BELVEDERE_TEST_QUESTION_IDS`.

## Architecture Patterns

### Pattern 1: Adding New Pillar Rules

**Step 1:** Add service entries to `SERVICE_RECOMMENDATIONS` array in `scripts/setup-all-pillar-rules.ts`:
```typescript
// Source: scripts/setup-all-pillar-rules.ts (existing pattern)
{
  id: 'liquidity_reserve_review',
  name: 'Liquidity Reserve Review',
  description: 'Assessment of emergency reserves and credit line availability',
  category: 'advisory',
  priority: 1,
  estimatedCost: '$5,000 - $12,000',
  timeframe: '2-4 weeks',
  tier: 'BASELINE' as const,
  complexity: 'MEDIUM' as const,
}
```

**Step 2:** Add rule entries to `LEGACY_RECOMMENDATION_RULES` in the same file:
```typescript
{
  id: 'liquidity_reserve_needed',
  serviceRecommendationId: 'liquidity_reserve_review',
  ruleName: 'Liquidity Reserve Assessment',
  triggerConditions: [
    {
      type: 'score_threshold',
      pillarId: 'liquidity-cash',
      operator: 'less_than',
      value: 1.5,
      weight: 3
    }
  ],
  priority: 88
}
```

**Step 3:** Add question fixture IDs to `BELVEDERE_TEST_QUESTION_IDS` in `belvedere-pillar-questions.ts` and add row definitions following the existing `row()` helper pattern.

**Step 4:** Add UI rules to `FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES` in `family-governance-recommendation-rules.ts` referencing new question IDs.

**Step 5:** Update `FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS` with new service IDs.

**Step 6:** Run `npm run seed:pillar-ddl` (or the equivalent for recommendation rules — this runs `scripts/setup-all-pillar-rules.ts`) to push to DB. New advisor accounts will get the rules via `cloneAdvisorDefaultsIfNeeded`; existing advisors get them via `syncMissingPlatformRecommendationRules`.

### Pattern 2: Advisor Override Flow Verification

The `buildAdvisorConfigSnapshot` in `snapshot.ts` already reads all `isActive` `AdvisorRecommendationRule` rows ordered by priority. The `recommendationRulesFromSnapshot` helper maps them to `RecommendationRule[]`. The `admin-rescore-actions.ts` passes this as `rulesOverride` to `matchAndDedupeRecommendations`.

The submission route (`/api/assessment/enhanced/submit/route.ts`) currently calls `generateRecommendations` WITHOUT a `rulesOverride`, so it pulls from DB platform rules rather than the snapshot. This is a gap: advisor-customized rules are not applied at submission time for this code path. The rescore action does it right. The submission path should call `resolveRecommendationRulesForAssessment` and pass the result.

### Pattern 3: Naming Conventions for New Pillar Services

Existing service ID prefixes: `governance_*`, `physical_*`, `insurance_*`, `geographic_*`, `social_*`, `cyber_*`

Follow the same prefix pattern for new pillars:
- `liquidity-cash` pillar → `liquidity_*` service IDs and rule IDs
- `tax-exposure` pillar → `tax_*`
- `estate-succession` pillar → `estate_*`
- `family-governance-behavioral` pillar → `behavioral_*`

### Anti-Patterns to Avoid

- **Creating new engine classes:** The RecommendationEngine is fully pillar-agnostic. Do not create pillar-specific engines.
- **Skipping the seed script:** Rules must live in the DB as `RecommendationRule` rows. Hardcoded arrays not in the DB will not be cloned to advisors and won't appear in snapshots.
- **Missing `FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS` update:** The test that asserts all services fire on all-no answers depends on this constant. New services MUST be added or the test will fail to catch regressions.
- **Omitting test fixture rows:** The `belvedere-pillar-questions.ts` test fixtures only cover 6 pillars. Without adding rows for the 4 new pillars, all-no scoring tests will have zero coverage for those pillars.
- **Using `weight: 0` in conditions:** Engine divides by `totalWeight`; zero causes `NaN` match ratio, rule never fires.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pillar-specific recommendation logic | Custom engine per pillar | RecommendationEngine with new rules | Engine already handles all 5 condition types for any pillar |
| Advisor rule override | Custom lookup per submission | `resolveRecommendationRulesForAssessment` + `rulesOverride` param | Already wired in rescore action |
| Condition validation | Custom Zod schema | `conditionSchema` from `recommendation-rule-schemas.ts` | Already covers all 5 types with cross-validation |
| Rule cloning to new advisors | Manual DB insert | `cloneAdvisorDefaultsIfNeeded` | Called automatically at advisor onboarding |
| Rule backfill to existing advisors | Migration script | `syncAdvisorPlatformContent` (called in `buildAdvisorConfigSnapshot`) | Already handles backfill on every snapshot build |

## Common Pitfalls

### Pitfall 1: Submission Route Bypasses Advisor Customization
**What goes wrong:** Assessment submits with platform-default rules even when an advisor has customized rules.
**Why it happens:** `/api/assessment/enhanced/submit/route.ts` calls `generateRecommendations` without `rulesOverride`. The rescore path correctly uses `resolveRecommendationRulesForAssessment`.
**How to avoid:** Add `resolveRecommendationRulesForAssessment(assessmentId)` call in the submit route, pass result as `rulesOverride`.
**Warning signs:** Advisor-disabled rules still fire in submitted assessments.

### Pitfall 2: New Platform Rules Don't Reach Existing Advisors
**What goes wrong:** New rules seeded to `RecommendationRule` table are not cloned to existing `AdvisorRecommendationRule` rows, so snapshot-based recommendation generation misses them.
**Why it happens:** `cloneAdvisorDefaultsIfNeeded` is idempotent (skips if already cloned). `syncMissingPlatformRecommendationRules` is called inside `buildAdvisorConfigSnapshot` → `ensureAdvisorDefaultsCloned` → `syncAdvisorPlatformContent`. This DOES run on every snapshot build, so new rules will appear for new assessments.
**How to avoid:** Verify `syncMissingPlatformRecommendationRules` path runs on assessment start, not just first-ever clone.

### Pitfall 3: Rule Fires for Wrong Pillar Score
**What goes wrong:** A new pillar rule uses a `score_threshold` condition with `pillarId: 'liquidity-cash'` but the assessment's `pillarScores` map uses a different key.
**Why it happens:** `pillarScores` keys in `RecommendationContext` must exactly match the `pillarId` strings in condition objects. The pillar registry normalizes slugs, but the rule conditions do not go through that normalization.
**How to avoid:** Use the exact pillar slugs from `PLATFORM_PILLAR_CATALOG` as `pillarId` in conditions: `governance`, `cyber-digital`, `physical-security`, `insurance`, `geographic-environmental`, `reputational-social`, `liquidity-cash`, `tax-exposure`, `estate-succession`, `family-governance-behavioral`.

### Pitfall 4: `FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS` Out of Sync
**What goes wrong:** `recommendation-happy-path.test.ts` "all-no Belvedere catalog" test passes but new services are never verified.
**Why it happens:** The constant is manually maintained and the test asserts exact equality.
**How to avoid:** Add every new `serviceRecommendationId` to `FAMILY_GOVERNANCE_ALL_NO_EXPECTED_SERVICE_IDS` when adding rules, and add corresponding question fixture rows so the all-no test exercises the new conditions.

### Pitfall 5: Missing `pillarId` on `AdvisorRecommendationRule` Clone
**What goes wrong:** `buildAdvisorConfigSnapshot` reads `recRuleRows` with `include: { pillar: true }` to populate `pillarSlug`. If the platform `RecommendationRule` has `triggerConditions` with a single `pillarId` field but the clone was created with `pillarId: null`, the snapshot `recRule.pillarSlug` will be null.
**Why it happens:** `createPlatformRecommendationClone` extracts `pillarSlug` from `conditions.pillarId` (reads only the first condition's pillarId). Rules with no `score_threshold` or `risk_level` condition as the first condition may get `pillarId: null`.
**How to avoid:** Ensure new `FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES` entries have at least one `score_threshold` or `risk_level` condition with a `pillarId`, or verify that the null case doesn't break snapshot or rescore logic (it doesn't break the engine — `pillarSlug` on the snapshot rule is metadata only).

## Code Examples

### Adding ServiceRecommendation + RecommendationRule for New Pillar
```typescript
// Source: scripts/setup-all-pillar-rules.ts (existing pattern to replicate)

// 1. Add to SERVICE_RECOMMENDATIONS array:
{
  id: 'liquidity_reserve_review',
  name: 'Liquidity Reserve Assessment',
  description: 'Review emergency reserves, credit line availability, and illiquid concentration risk',
  category: 'advisory',
  priority: 1,
  estimatedCost: '$5,000 - $12,000',
  timeframe: '2-4 weeks',
  tier: 'BASELINE' as const,
  complexity: 'MEDIUM' as const,
  metadata: { services: ['Reserve adequacy', 'Credit line review', 'Illiquidity stress test'] }
},

// 2. Add to LEGACY_RECOMMENDATION_RULES array:
{
  id: 'liquidity_reserve_needed',
  serviceRecommendationId: 'liquidity_reserve_review',
  ruleName: 'Liquidity Reserve Assessment',
  description: 'Households without documented reserve targets need liquidity assessment',
  triggerConditions: [
    { type: 'score_threshold', pillarId: 'liquidity-cash', operator: 'less_than', value: 1.5, weight: 3 },
    { type: 'risk_level', pillarId: 'liquidity-cash', operator: 'in', value: ['high', 'critical'], weight: 2 }
  ],
  priority: 88
}
```

### Adding UI Rules for New Pillar
```typescript
// Source: src/lib/assessment/engines/family-governance-recommendation-rules.ts (existing pattern)
{
  id: 'fg_ui_liquidity_reserve',
  serviceRecommendationId: 'liquidity_reserve_review',
  ruleName: 'Liquidity reserve (Belvedere)',
  triggerConditions: [
    { type: 'answer_match', questionId: Q.liqA1, operator: 'equals', value: 0, weight: 4 },
    { type: 'score_threshold', pillarId: 'liquidity-cash', operator: 'less_than', value: 1.5, weight: 2 },
  ],
  priority: 88,
},
```

### Adding Test Fixture Rows for New Pillar
```typescript
// Source: src/lib/assessment/test-fixtures/belvedere-pillar-questions.ts (existing pattern)
export const BELVEDERE_TEST_QUESTION_IDS = {
  // ... existing keys ...
  liqA1: "belvedere-liq-a1",
  liqA2: "belvedere-liq-a2",
  liqA3: "belvedere-liq-a3",
  // ... tax, estate, behavioral similarly
} as const;

// Then in BELVEDERE_ROWS array:
row(BELVEDERE_TEST_QUESTION_IDS.liqA1, "liquidity-cash", "Emergency reserve documentation", "scored_0_3"),
```

### Fixing Submission Route to Use Advisor Rules
```typescript
// Source: src/app/api/assessment/enhanced/submit/route.ts (current gap to fix)
import { resolveRecommendationRulesForAssessment } from '@/lib/methodology/assessment-runtime';

// Inside the route handler:
const rulesOverride = await resolveRecommendationRulesForAssessment(validatedData.assessmentId);
const recommendationEngine = new RecommendationEngine();
recommendations = await recommendationEngine.generateRecommendations({
  assessmentId: validatedData.assessmentId,
  userId: session.user.id!,
  pillarScores,
  answers: validatedData.answers,
  householdProfile: null,
  missingControls: scoreResult.missingControls,
}, rulesOverride);  // pass rulesOverride
```

## Open Questions

1. **Should the submission route use all-pillar scores or single-pillar scores?**
   - What we know: The submit route currently calls `generateRecommendations` per-pillar (only the current pillar's score is in context), meaning cross-pillar rules (e.g., a rule requiring both governance and liquidity to be critical) won't fire until rescore.
   - What's unclear: Whether the rescore action is always run after full assessment completion, making this a timing issue rather than a correctness issue.
   - Recommendation: At minimum fix the `rulesOverride` gap. Cross-pillar scoring can be addressed as a follow-on if needed.

2. **How many services per new pillar?**
   - What we know: Existing pillars have 3 services each (assessment, implementation, specialized). New pillar question banks have 3 questions each.
   - What's unclear: Whether 3 services per pillar is the target or if fewer suffice for phase 21.
   - Recommendation: Use 2-3 services per pillar following the existing naming pattern.

3. **Do test fixture question IDs need to match actual DB question IDs?**
   - What we know: `BELVEDERE_TEST_QUESTION_IDS` are synthetic IDs used only in tests. Actual DB question IDs come from `NEW_PILLAR_ASSESSMENT_STARTERS` question numbers via the seed.
   - What's unclear: Whether the UI rules referencing `Q.liqA1` etc. need to match DB question IDs for production correctness.
   - Recommendation: The UI rules in `FAMILY_GOVERNANCE_UI_RECOMMENDATION_RULES` reference test IDs. Matching them to production DB IDs (from the seed SQL) is important for production correctness. Investigate whether the workbook import assigns predictable IDs or if a mapping layer is needed.

## Sources

### Primary (HIGH confidence)
- `src/lib/assessment/engines/recommendation-engine.ts` — engine implementation, all condition types
- `src/lib/assessment/engines/family-governance-recommendation-rules.ts` — existing UI rules pattern
- `src/lib/assessment/engines/recommendation-catalog-fixtures.ts` — production catalog constants
- `scripts/setup-all-pillar-rules.ts` — seed script pattern
- `src/lib/methodology/clone-advisor-defaults.ts` — clone + sync pattern
- `src/lib/methodology/snapshot.ts` — snapshot build and rule loading
- `src/lib/methodology/assessment-runtime.ts` — `resolveRecommendationRulesForAssessment`
- `src/lib/admin/recommendation-rule-schemas.ts` — Zod condition schemas
- `src/lib/assessment/test-fixtures/belvedere-pillar-questions.ts` — test fixture pattern
- `src/lib/methodology/new-pillar-assessment-starter.ts` — 4 new pillar question starters
- `src/lib/methodology/pillar-catalog-starter.ts` — canonical 10 pillar slugs
- `prisma/schema.prisma` — DB models for all recommendation tables

## Metadata

**Confidence breakdown:**
- Existing engine/infrastructure: HIGH — read directly from source
- Missing content (4 pillars): HIGH — confirmed by absence of entries in seed script and test fixtures
- Submission route gap: HIGH — confirmed by reading route source
- Test coverage gaps: HIGH — belvedere-pillar-questions.ts has no rows for 4 pillars

**Research date:** 2026-06-25
**Valid until:** 60 days (stable codebase, internal research)
