# Phase 24: Continuous Risk Improvement - Research

**Researched:** 2026-06-27
**Domain:** Assessment versioning, score delta computation, review cadence scheduling, intelligence timeline
**Confidence:** HIGH

## Summary

Phase 24 closes the assessment-to-improvement loop. The existing codebase provides strong foundations: `Assessment.version` (Int, default 1) and `Assessment.includedPillars` already exist, `PillarScore` stores per-pillar scores with breakdown JSON keyed by `(assessmentId, pillar)`, and `SolutionActivity` is an append-only log with a `varchar(60)` action field ready for new event types. The recommendation engine stores `triggerReason` JSON with `questionId` references in its `RecommendationCondition` objects, enabling targeted follow-up question selection.

The primary new schema requirement is a `previousAssessmentId` self-referential link on Assessment (does not exist today -- confirmed by grep). No new models are needed for the intelligence timeline -- `SolutionActivity` handles new action types without schema changes. The Review Cadence Engine requires a new `ReviewCadence` model for per-client scheduling state and a new cron route following the established `src/app/api/cron/` pattern (CRON_SECRET auth, timing-safe comparison).

**Primary recommendation:** Add `previousAssessmentId` to Assessment, create a `ReviewCadence` model, extend `SOLUTION_ACTIONS` with intelligence event types, and build delta computation as a pure function over two `PillarScore[]` arrays.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Three reassessment types: Full Assessment, Domain/Pillar Reassessment, Targeted Follow-up
- **D-02:** All reassessment types start fresh (no pre-filled answers). Previous assessment preserved as-is
- **D-03:** Targeted follow-up uses recommendation-linked question selection
- **D-04:** Assessment versioning via chain (previousAssessmentId). Version number increments
- **D-05:** Per-pillar comparison cards with previous/current score, delta, and attribution
- **D-06:** Pillars with no activity show explicit zero-state
- **D-07:** Score deltas visible to both client and advisor with attribution
- **D-08:** Enterprise sets default cadence; advisor can override per client
- **D-09:** System recommends reassessments based on events
- **D-10:** Review Cadence Engine manages reassessment lifecycle
- **D-11:** No separate timeline model -- evolve Phase 23 SolutionActivity/activity feed
- **D-12:** New intelligence event types: assessment, score change, cadence, recommendation impact

### Claude's Discretion
- Assessment versioning schema design (previousAssessmentId link vs separate version table)
- Targeted follow-up question selection algorithm
- Review cadence engine scheduling mechanism (cron vs event-driven vs hybrid)
- Score delta computation approach
- Timeline event schema extension strategy
- Reassessment UI flow (reuse existing vs separate)
- System-recommended reassessment trigger thresholds

### Deferred Ideas (OUT OF SCOPE)
- Client-to-client collaboration on shared assessment responses
- AI-powered predictive risk modeling
- External compliance framework mapping
- Automated dark web monitoring integration
- Push notification delivery (mobile)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFECYCLE-03 | Continuous risk improvement: reassessment, score deltas, impact measurement, review cadence, risk intelligence timeline | Full coverage: versioning via previousAssessmentId chain, PillarScore delta computation, SolutionActivity event extension, ReviewCadence model + cron, reassessment flow reusing existing assessment engine |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Assessment versioning (previousAssessmentId chain) | Database / Storage | API / Backend | Self-referential FK on Assessment; version increment logic in server actions |
| Reassessment flow (create new linked assessment) | API / Backend | Frontend Server (SSR) | Server action creates Assessment row, SSR renders entry point |
| Score delta computation | API / Backend | -- | Pure function comparing two PillarScore[] arrays; no client logic |
| Delta attribution (recommendation -> question mapping) | API / Backend | -- | Traces triggerReason JSON -> questionId -> completed recommendations |
| Pillar delta comparison UI | Frontend Server (SSR) | Browser / Client | SSR fetches data, client renders delta cards with Recharts |
| Review Cadence Engine | API / Backend | -- | Cron route + server actions; no client-side scheduling |
| Intelligence timeline | API / Backend | Frontend Server (SSR) | SolutionActivity query with new action types; SSR renders feed |
| Feature flag gating | API / Backend | -- | Extends Phase 23 enterprise flag pattern |

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | App router, SSR, API routes, cron routes | Project framework [VERIFIED: package.json] |
| Prisma | 7.8.0 | ORM, migrations, schema management | Project ORM [VERIFIED: package.json] |
| date-fns | 4.1.0 | Date arithmetic for cadence computation | Already used for engagement metrics [VERIFIED: package.json] |
| recharts | 3.8.0 | Score trend and delta visualization | Already used by ScoreTrendChart, GovernanceTrendChart [VERIFIED: package.json] |
| zod | (installed) | Server action input validation | Project standard [VERIFIED: codebase pattern] |
| lucide-react | (installed) | Icons for timeline event types | Project standard [VERIFIED: UI-SPEC] |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui (via shadcn) | (installed) | Dialog, Tabs, Select, Tooltip for delta UI | All new UI surfaces per UI-SPEC |

**No new packages required.** Phase 24 builds entirely on the existing stack.

## Package Legitimacy Audit

No new packages to install. All libraries referenced above are already in the project's dependency tree.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Client/Advisor clicks "Start Reassessment"
        |
        v
[Reassessment Type Dialog]
  |         |         |
  v         v         v
Full    Pillar    Targeted
  |         |         |
  |    [Pillar      [Question
  |     Select]      Selector]
  |         |         |
  v---------v---------v
[Create Assessment (server action)]
  - previousAssessmentId = current.id
  - version = current.version + 1
  - includedPillars = [selected] or []
  - status = IN_PROGRESS
        |
        v
[Existing Assessment Flow]
  (question display, answer capture, scoring)
        |
        v
[Assessment Completion (existing)]
  - PillarScore rows created
  - Recommendations generated
        |
        v
[Score Delta Computation]
  - Load previous PillarScore[]
  - Load current PillarScore[]
  - Compute per-pillar delta + direction
  - Attribution: completed recommendations linked to questions
        |
        v
[Intelligence Event Logging]
  - SolutionActivity entries for assessment, score, cadence events
        |
        v
[Pillar Delta Comparison UI]   [Intelligence Timeline UI]
  (client dashboard +             (tabbed activity feed
   advisor client detail)          with new event types)

[Review Cadence Engine (cron)]
  - Daily cron checks ReviewCadence rows
  - Sends reminders for due/overdue
  - System-recommended reassessments
```

### Recommended Project Structure
```
src/
├── lib/
│   ├── assessment/
│   │   ├── reassessment.ts          # Create reassessment, version chain
│   │   └── targeted-followup.ts     # Question selection from recommendation links
│   ├── analytics/
│   │   └── score-delta.ts           # Delta computation, attribution
│   ├── cadence/
│   │   ├── review-cadence.ts        # Cadence CRUD, due date computation
│   │   └── system-triggers.ts       # Auto-recommendation logic
│   └── engagement/
│       └── intelligence-events.ts   # New event type constants + logging helpers
├── actions/
│   ├── reassessment-actions.ts      # Server actions for reassessment flow
│   └── cadence-actions.ts           # Server actions for cadence management
├── app/
│   └── api/cron/
│       └── review-cadence/route.ts  # Cron route for cadence checks
├── components/
│   ├── assessment/
│   │   ├── ReassessmentDialog.tsx    # Type selector dialog
│   │   └── PillarDeltaPanel.tsx      # Per-pillar comparison cards
│   └── engagement/
│       ├── IntelligenceTimeline.tsx   # Extended activity feed with tabs
│       └── ReviewCadencePanel.tsx     # Cadence status + override
```

### Pattern 1: Assessment Versioning via Self-Referential Link

**What:** Add `previousAssessmentId` as optional self-referential FK on Assessment. Version number increments from previous assessment's version.

**When to use:** Every reassessment creates a new Assessment row linked to the previous one.

**Example:**
```typescript
// Schema addition (prisma/schema.prisma)
model Assessment {
  // ... existing fields ...
  previousAssessmentId String?
  previousAssessment   Assessment?  @relation("AssessmentChain", fields: [previousAssessmentId], references: [id], onDelete: SetNull)
  nextAssessments      Assessment[] @relation("AssessmentChain")
  // ... rest of model ...
}

// Server action: create reassessment
async function createReassessment(input: {
  userId: string;
  previousAssessmentId: string;
  type: "full" | "pillar" | "targeted";
  includedPillars?: string[];
}) {
  const previous = await prisma.assessment.findUniqueOrThrow({
    where: { id: input.previousAssessmentId },
    select: { version: true, snapshotId: true },
  });

  return prisma.assessment.create({
    data: {
      userId: input.userId,
      previousAssessmentId: input.previousAssessmentId,
      version: previous.version + 1,
      status: "IN_PROGRESS",
      includedPillars: input.includedPillars ?? [],
      snapshotId: previous.snapshotId, // reuse methodology snapshot
    },
  });
}
```
[VERIFIED: Assessment model at prisma/schema.prisma:405, version field exists at line 411]

### Pattern 2: Score Delta Computation

**What:** Pure function comparing two PillarScore arrays from different assessments.

**When to use:** After a reassessment completes, compute deltas for the comparison panel.

**Example:**
```typescript
// Source: PillarScore model at schema.prisma:536
type PillarDelta = {
  pillar: string;
  previousScore: number;
  currentScore: number;
  delta: number;
  direction: "improved" | "regressed" | "unchanged";
  previousRiskLevel: string;
  currentRiskLevel: string;
  attribution: string[]; // completed recommendation names
};

function computePillarDeltas(
  previousScores: PillarScore[],
  currentScores: PillarScore[],
  completedRecommendations: { pillar: string; name: string }[],
): PillarDelta[] {
  const previousMap = new Map(previousScores.map(s => [s.pillar, s]));

  return currentScores.map(current => {
    const prev = previousMap.get(current.pillar);
    const delta = prev ? current.score - prev.score : 0;
    const attribution = completedRecommendations
      .filter(r => r.pillar === current.pillar)
      .map(r => r.name);

    return {
      pillar: current.pillar,
      previousScore: prev?.score ?? 0,
      currentScore: current.score,
      delta: Math.round(delta * 100) / 100,
      direction: delta > 0.01 ? "improved" : delta < -0.01 ? "regressed" : "unchanged",
      previousRiskLevel: prev?.riskLevel ?? "unknown",
      currentRiskLevel: current.riskLevel,
      attribution: attribution.length > 0
        ? attribution
        : ["No new planning activity"],
    };
  });
}
```
[VERIFIED: PillarScore model at schema.prisma:536, unique on (assessmentId, pillar)]

### Pattern 3: Extending SolutionActivity for Intelligence Events

**What:** Add new action type constants to `SOLUTION_ACTIONS`. No schema migration needed -- `action` is `varchar(60)`.

**When to use:** Every intelligence event (assessment, score change, cadence, recommendation impact).

**Example:**
```typescript
// Extend SOLUTION_ACTIONS in solution-lifecycle.ts
export const INTELLIGENCE_ACTIONS = {
  // Assessment events
  ASSESSMENT_STARTED: "assessment_started",
  ASSESSMENT_COMPLETED: "assessment_completed",
  ASSESSMENT_SCORE_CALCULATED: "score_calculated",
  REASSESSMENT_TRIGGERED: "reassessment_triggered",
  // Score change events
  PILLAR_SCORE_DELTA: "pillar_score_delta",
  RISK_LEVEL_TRANSITION: "risk_level_transition",
  // Cadence events
  CADENCE_DUE_APPROACHING: "cadence_due_approaching",
  CADENCE_OVERDUE: "cadence_overdue",
  CADENCE_CHANGED: "cadence_changed",
  CADENCE_SYSTEM_RECOMMENDED: "cadence_system_recommended",
  // Recommendation impact events
  RECOMMENDATION_IMPACT_MEASURED: "recommendation_impact_measured",
  COMPLETION_MILESTONE_REACHED: "completion_milestone_reached",
} as const;
```
[VERIFIED: SolutionActivity model at schema.prisma:2038, action is varchar(60)]

### Pattern 4: Review Cadence Engine (Cron)

**What:** Daily cron route checks ReviewCadence rows for due/overdue reassessments.

**When to use:** Scheduled background processing for cadence management.

**Example:**
```typescript
// New model in schema.prisma
model ReviewCadence {
  id                String        @id @default(cuid())
  clientId          String
  advisorProfileId  String
  frequency         CadenceFrequency @default(ANNUAL)
  nextDueDate       DateTime
  lastAssessmentId  String?
  isOverridden      Boolean       @default(false) // true = advisor set, false = enterprise default
  systemRecommended Boolean       @default(false) // true = AKILI triggered
  systemRecommendationReason String?
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt

  client           User            @relation(fields: [clientId], references: [id], onDelete: Cascade)
  advisorProfile   AdvisorProfile  @relation(fields: [advisorProfileId], references: [id], onDelete: Cascade)

  @@unique([clientId, advisorProfileId])
  @@index([nextDueDate])
}

enum CadenceFrequency {
  QUARTERLY    // 90 days
  SEMI_ANNUAL  // 180 days
  ANNUAL       // 365 days
}

// Cron route pattern: src/app/api/cron/review-cadence/route.ts
// Same CRON_SECRET auth pattern as advisory-outreach-reminder
```
[VERIFIED: Cron pattern at src/app/api/cron/advisory-outreach-reminder/route.ts]

### Pattern 5: Targeted Follow-up Question Selection

**What:** Trace from completed recommendations back to the questions that triggered them.

**When to use:** When building the targeted follow-up question set.

**Algorithm:**
1. Find completed `AssessmentRecommendation` rows for the client's current assessment
2. For each, load the linked `ServiceRecommendation` -> `RecommendationRule` -> `triggerConditions` JSON
3. Extract `questionId` from conditions of type `answer_match` and `missing_control`
4. Deduplicate question IDs
5. These are the questions to re-ask in the targeted follow-up

```typescript
// Source: RecommendationRule model at schema.prisma:1454
// triggerConditions JSON contains: [{ type, questionId, operator, value, weight }]
async function getTargetedFollowupQuestions(
  assessmentId: string,
): Promise<string[]> {
  const completedRecs = await prisma.assessmentRecommendation.findMany({
    where: {
      assessmentId,
      status: "COMPLETED",
    },
    include: {
      serviceRecommendation: {
        include: {
          recommendationRules: {
            where: { isActive: true },
            select: { triggerConditions: true },
          },
        },
      },
    },
  });

  const questionIds = new Set<string>();
  for (const rec of completedRecs) {
    for (const rule of rec.serviceRecommendation.recommendationRules) {
      const conditions = rule.triggerConditions as RecommendationCondition[];
      for (const cond of conditions) {
        if (
          (cond.type === "answer_match" || cond.type === "missing_control") &&
          cond.questionId
        ) {
          questionIds.add(cond.questionId);
        }
      }
    }
  }

  return Array.from(questionIds);
}
```
[VERIFIED: RecommendationCondition has questionId field, recommendation-engine.ts:48. RecommendationRule.triggerConditions stores these at schema.prisma:1459]

### Anti-Patterns to Avoid
- **Mutating previous assessment:** D-02 requires previous assessment preserved as-is. Never update scores, responses, or status on the previous assessment.
- **Pre-filling answers on reassessment:** D-02 explicitly forbids pre-filled answers. Start fresh.
- **Separate timeline model:** D-11 says extend SolutionActivity, not create a new model.
- **Computing deltas client-side:** Delta computation involves joining PillarScores across assessments and mapping recommendations. Keep this server-side.
- **Hardcoding cadence intervals:** Use the enum + `date-fns` `addDays`/`addMonths` for cadence computation. Enterprise may change defaults.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic for cadence | Manual day/month calculation | `date-fns` `addDays`, `addMonths`, `differenceInDays` | Timezone, leap year, month-length edge cases |
| Score trend visualization | Custom SVG charts | `recharts` (existing `ScoreTrendChart` pattern) | Already validated in project, handles responsive containers |
| Cron auth | Custom token validation | CRON_SECRET + `timingSafeEqual` pattern (existing) | Timing attack prevention, consistency with 5 existing cron routes |
| Activity feed pagination | Custom offset tracking | Existing `getClientActivityFeed` pattern with offset/limit | Already handles role filtering, join through AssessmentRecommendation |
| Pillar name display | Hardcoded strings | `pillarDisplayName()` from `pillar-registry.ts` | Handles dynamic pillar catalog, normalization |

## Common Pitfalls

### Pitfall 1: SolutionActivity Requires assessmentRecommendationId
**What goes wrong:** Intelligence events (assessment completed, cadence overdue) are not tied to a specific recommendation, but SolutionActivity requires `assessmentRecommendationId` (non-nullable FK).
**Why it happens:** SolutionActivity was designed for recommendation lifecycle events only.
**How to avoid:** Two approaches: (a) Create a sentinel/system AssessmentRecommendation row per assessment to anchor non-recommendation events, or (b) make `assessmentRecommendationId` nullable with a migration and add an `assessmentId` FK for assessment-scoped events. Option (b) is cleaner but requires a schema migration. Recommendation: option (b) -- add optional `assessmentId` to SolutionActivity so events can be scoped to an assessment without a recommendation.
**Warning signs:** Foreign key constraint violations when trying to log assessment-level events.

### Pitfall 2: Version Number Drift
**What goes wrong:** `Assessment.version` is currently bumped by `rescoreAssessment` (rescore increments version). A reassessment that creates a new Assessment row also needs a version. These two version semantics could conflict.
**Why it happens:** `version` currently means "rescore count" (default 1, first rescore writes 2). Phase 24 wants it to mean "assessment sequence number."
**How to avoid:** Use a separate field for reassessment sequence (e.g., `reassessmentNumber`) or rename the existing `version` field's semantics. The safest approach: use `previousAssessmentId` chain length as the canonical reassessment version (walk the chain), and keep `version` for its existing rescore-count purpose.
**Warning signs:** Confusion between "v3 (rescored twice)" and "v3 (third assessment)."

### Pitfall 3: Delta Attribution Requires Recommendation-Pillar Mapping
**What goes wrong:** Completed recommendations need to be attributed to specific pillars for delta explanation, but `AssessmentRecommendation` doesn't store a pillar field directly.
**Why it happens:** Recommendations are linked to `ServiceRecommendation.category` which maps to pillars, but the mapping isn't always 1:1.
**How to avoid:** Map through `ServiceRecommendation.category` to pillar ID. The category field on ServiceRecommendation uses pillar-compatible slugs (governance, cyber-digital, etc.). Verify the mapping at implementation time.
**Warning signs:** Attribution showing "No new planning activity" even when recommendations were completed for that pillar.

### Pitfall 4: Targeted Follow-up With Zero Eligible Questions
**What goes wrong:** Client clicks "Targeted Follow-up" but no completed recommendations have linked questions.
**Why it happens:** Not all recommendation rules use `answer_match` or `missing_control` conditions with `questionId`. Some use only `score_threshold` or `risk_level` (pillar-level, no question link).
**How to avoid:** Pre-compute eligible question count before showing the option. UI-SPEC already specifies: disabled state with tooltip "No completed recommendations with linked questions yet." Count badge shows "N eligible questions."
**Warning signs:** Empty assessment with zero questions.

### Pitfall 5: Cadence Cron Sending Duplicate Reminders
**What goes wrong:** Daily cron fires reminders on every run for overdue cadences.
**Why it happens:** No dedup mechanism like `lastReminderSentAt`.
**How to avoid:** Add `lastReminderSentAt` to ReviewCadence. Skip rows where `lastReminderSentAt` is within the configured reminder interval (e.g., 7 days for annual cadence).
**Warning signs:** Advisors receiving daily emails about the same overdue reassessment.

## Code Examples

### Existing Analytics Pattern (SSR + Suspense)
```typescript
// Source: src/app/(protected)/advisor/analytics/[clientId]/page.tsx
// Pattern: async server component with Suspense boundary
async function AnalyticsContent({ clientId }: { clientId: string }) {
  const result = await getFamilyAnalyticsData(clientId);
  if (!result.success) {
    return <ErrorState error={result.error} />;
  }
  // ... render charts and comparison views
}

export default async function AnalyticsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  return (
    <Suspense fallback={<Skeleton />}>
      <AnalyticsContent clientId={clientId} />
    </Suspense>
  );
}
```
[VERIFIED: src/app/(protected)/advisor/analytics/[clientId]/page.tsx]

### Existing Trend Direction Calculation
```typescript
// Source: src/lib/analytics/queries.ts:62-69
function getTrendDirection(currentScore: number, previousScore: number | null):
  'improving' | 'declining' | 'stable' | 'new' {
  if (previousScore === null) return 'new';
  const difference = currentScore - previousScore;
  if (difference > 0.3) return 'improving';
  if (difference < -0.3) return 'declining';
  return 'stable';
}
```
[VERIFIED: src/lib/analytics/queries.ts:62]

### Existing Feature Flag Pattern
```typescript
// Source: src/lib/engagement/feature-flags.ts
export async function isImplementationTrackingEnabled(
  advisorProfileId: string,
): Promise<boolean> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      enterprise: {
        select: { implementationTrackingEnabled: true },
      },
    },
  });
  if (!profile) return false;
  return profile.enterprise?.implementationTrackingEnabled ?? true;
}
```
[VERIFIED: src/lib/engagement/feature-flags.ts:11-29]

### Existing Cron Route Auth Pattern
```typescript
// Source: src/app/api/cron/advisory-outreach-reminder/route.ts
const authHeader = request.headers.get("Authorization");
const expectedSecret = process.env.CRON_SECRET;
// ... length check + timingSafeEqual ...
```
[VERIFIED: src/app/api/cron/advisory-outreach-reminder/route.ts:29-61]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Assessment.version` for rescore count | Keep for rescore; use `previousAssessmentId` chain for reassessment sequence | Phase 24 (new) | Avoids semantic confusion between rescore version and reassessment version |
| Activity feed shows recommendation events only | Intelligence timeline shows assessment, score, cadence, and recommendation events | Phase 24 (new) | Broader event taxonomy, tabbed filtering |
| No assessment linking | Self-referential `previousAssessmentId` chain | Phase 24 (new) | Enables delta computation and version history |

**Deprecated/outdated:**
- None relevant to this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `ServiceRecommendation.category` maps cleanly to pillar IDs for attribution | Architecture Patterns (Pattern 5) | Attribution text would show "No new planning activity" incorrectly; need a manual mapping table |
| A2 | Making `SolutionActivity.assessmentRecommendationId` nullable is safe for existing queries | Pitfalls (Pitfall 1) | Existing activity feed queries filter on assessmentRecommendationId; null rows would need exclusion in existing queries |
| A3 | Enterprise cadence default should live on `AdvisorEnterprise` model | Architecture Patterns (Pattern 4) | If enterprise doesn't own cadence config, need separate config table |
| A4 | `Assessment.snapshotId` should be reused (not re-snapshotted) for reassessments | Architecture Patterns (Pattern 1) | If methodology changed between assessments, reusing snapshot gives stale methodology |

## Open Questions

1. **SolutionActivity FK constraint for assessment-level events**
   - What we know: SolutionActivity requires assessmentRecommendationId (non-nullable). Intelligence events like "assessment completed" have no recommendation context.
   - What's unclear: Whether to make the FK nullable or create a separate table for assessment-level events.
   - Recommendation: Make assessmentRecommendationId nullable, add assessmentId as optional FK. This keeps all events in one table per D-11. Update existing `getClientActivityFeed` query to handle nulls.

2. **Version field semantics**
   - What we know: `Assessment.version` is currently a rescore counter (default 1, bumped by rescoreAssessment). Phase 24 needs a reassessment sequence number.
   - What's unclear: Whether to repurpose `version` or add a new field.
   - Recommendation: Keep `version` as rescore counter. Derive reassessment sequence from `previousAssessmentId` chain. Add a helper function `getReassessmentNumber(assessmentId)` that walks the chain.

3. **Methodology snapshot on reassessment**
   - What we know: Assessments link to `IntakeSnapshot` via `snapshotId`. If methodology changes between assessments, the new assessment should use the current methodology.
   - What's unclear: Whether to re-snapshot or reuse.
   - Recommendation: Reuse the existing snapshotId for consistency (same scoring baseline for fair comparison). If methodology has changed, the advisor should explicitly trigger a new intake flow.

## Project Constraints (from CLAUDE.md)

- Use `@/*` path aliases for imports from `/src`
- Server actions in `/src/lib/actions` directory
- Database access through `prisma` from `@/lib/db`
- Auth checks via `auth()` from `@/lib/auth`
- shadcn/ui components in `/src/components/ui`
- Vitest for unit testing
- TypeScript strict mode
- Unused variables prefixed with `_`
- Role guards: `requireAdvisorRole` for advisor endpoints, `requireSuperAdminRole` for admin-only

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (global test environment) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFECYCLE-03a | Create reassessment linked to previous | unit | `npx vitest run src/lib/assessment/reassessment.test.ts -t "creates linked assessment"` | Wave 0 |
| LIFECYCLE-03b | Score delta computation | unit | `npx vitest run src/lib/analytics/score-delta.test.ts` | Wave 0 |
| LIFECYCLE-03c | Targeted follow-up question extraction | unit | `npx vitest run src/lib/assessment/targeted-followup.test.ts` | Wave 0 |
| LIFECYCLE-03d | Review cadence due date computation | unit | `npx vitest run src/lib/cadence/review-cadence.test.ts` | Wave 0 |
| LIFECYCLE-03e | Intelligence event logging | unit | `npx vitest run src/lib/engagement/intelligence-events.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/assessment/reassessment.test.ts` -- covers LIFECYCLE-03a
- [ ] `src/lib/analytics/score-delta.test.ts` -- covers LIFECYCLE-03b
- [ ] `src/lib/assessment/targeted-followup.test.ts` -- covers LIFECYCLE-03c
- [ ] `src/lib/cadence/review-cadence.test.ts` -- covers LIFECYCLE-03d
- [ ] `src/lib/engagement/intelligence-events.test.ts` -- covers LIFECYCLE-03e

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing auth via NextAuth |
| V3 Session Management | no | Existing session management |
| V4 Access Control | yes | `requireAdvisorRole` guard, `userId` scoping on Assessment queries, advisor-client assignment verification |
| V5 Input Validation | yes | Zod schemas for server action inputs (reassessment type, cadence frequency, pillar selection) |
| V6 Cryptography | no | No new crypto; answers remain encrypted via existing AES-256-GCM |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthorized reassessment creation | Elevation of Privilege | Verify userId matches session, advisor-client assignment check |
| Cross-client score comparison data leak | Information Disclosure | Always scope PillarScore queries by assessmentId, verify assessment belongs to requesting user |
| Cadence manipulation by non-advisor | Tampering | `requireAdvisorRole` on cadence CRUD actions, verify assignment |
| Cron route unauthorized access | Spoofing | CRON_SECRET + timingSafeEqual (existing pattern) |

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- Assessment (line 405), PillarScore (line 536), SolutionActivity (line 2038), AssessmentRecommendation (line 1511), RecommendationRule (line 1454), AdvisorEnterprise (line 150), ClientAdvisorAssignment (line 1102)
- `src/lib/assessment/scoring.ts` -- Pillar scoring algorithm
- `src/lib/assessment/assessment-completion.ts` -- Completion flow
- `src/lib/assessment/engines/recommendation-engine.ts` -- RecommendationCondition with questionId
- `src/lib/recommendations/solution-lifecycle.ts` -- SOLUTION_ACTIONS, state machine, activity logging
- `src/lib/engagement/activity-feed.ts` -- Activity feed query pattern
- `src/lib/engagement/feature-flags.ts` -- Enterprise feature flag pattern
- `src/lib/engagement/engagement-metrics.ts` -- Engagement aggregation queries
- `src/lib/analytics/queries.ts` -- Analytics data fetching, trend direction
- `src/components/family/ScoreTrendChart.tsx` -- Recharts trend chart pattern
- `src/app/api/cron/advisory-outreach-reminder/route.ts` -- Cron route auth pattern

### Secondary (MEDIUM confidence)
- None needed -- all findings verified from codebase.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, versions verified
- Architecture: HIGH - all patterns verified from existing codebase, schema inspected
- Pitfalls: HIGH - derived from actual schema constraints and code inspection

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (stable domain, no external dependency changes expected)
