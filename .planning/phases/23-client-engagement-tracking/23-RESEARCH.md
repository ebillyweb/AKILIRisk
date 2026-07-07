# Phase 23: Optional Client Engagement & Implementation Tracking - Research

**Researched:** 2026-06-27
**Domain:** Opt-in engagement tracking layer on existing recommendation lifecycle
**Confidence:** HIGH

## Summary

Phase 23 adds an opt-in project-management layer on top of Phase 22's recommendation lifecycle. The existing codebase already has most of the infrastructure: `SolutionMilestone` and `SolutionActivity` models, `updateMilestoneStatus()` in `solution-lifecycle.ts`, the `ProgressDashboard` component, and the `PortfolioEngagement` model. The work is primarily: (1) extend the `MilestoneStatus` enum with BLOCKED/DEFERRED, (2) add auto-completion detection, (3) build an activity feed component reading from existing `SolutionActivity` data, (4) add an enterprise feature flag for implementation tracking, (5) add an engagement column to the advisor portfolio, and (6) create an engagement analytics dashboard.

This is a "wiring and UI" phase, not a new system design. The data model is 80% built. The risk is low -- the biggest design challenge is the "zero noise" constraint: ensuring advisors who skip tracking see exactly today's experience.

**Primary recommendation:** Extend existing `solution-lifecycle.ts` with BLOCKED/DEFERRED support and auto-completion, then build activity feed and engagement dashboard as new UI surfaces reading from `SolutionActivity`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Enterprise-level feature flag controls whether implementation tracking exists for the firm. Disabled = zero UI change from today's behavior.
- **D-02:** Tracking auto-activates when the advisor publishes a Strategic Action Plan to the client. No separate "enable tracking" toggle or button.
- **D-03:** Advisor controls publication. If they never publish an Action Plan, the client never sees tracking features. The advisor's choice to publish is the activation gate.
- **D-04:** Chronological timeline, single stream per client (not per-recommendation). Reverse-chronological, collapsible by date grouping.
- **D-05:** Role-filtered: advisors see all events, clients see their own actions plus advisor-visible notes.
- **D-06:** Feed is an inline collapsible section ("Recent Activity") on the Strategic Action Plan page. Zero-state: section does not render until first activity exists. No empty states, no placeholder text.
- **D-07:** Advisor portfolio gets an engagement column in the existing client table showing actions count and completion percentage. Clients without a published action plan show "--" (zero noise).
- **D-08:** Separate engagement dashboard page for deep analytics: completion rates, stalled clients, upcoming milestones, overdue items.
- **D-09:** Client sees enhanced Action Plan with per-recommendation progress bars (milestone completion percentage) and a "Next Step" callout highlighting the most urgent incomplete milestone with due date. Enhances existing ProgressDashboard component.
- **D-10:** Preserve Phase 22's dual-track model: clients manage TaskStatus (Not Started / In Progress / Completed), advisors manage MilestoneStatus and ValidationStatus. Clients see playbook steps as a read-only checklist. No direct client milestone manipulation.
- **D-11:** Add BLOCKED and DEFERRED to MilestoneStatus enum. Blocked requires a reason. Deferred mirrors recommendation-level pattern (reason + optional revisit date).
- **D-12:** Auto-completion: when all milestones reach COMPLETED, SKIPPED, or DEFERRED, the recommendation auto-transitions to COMPLETED. Any BLOCKED milestone keeps the recommendation IN_PROGRESS with a blocked indicator on the advisor portfolio.

### Claude's Discretion

- Enterprise feature flag schema design and admin UI placement
- Action Plan "publish" mechanism (new status field vs explicit publish action)
- Activity feed query optimization and pagination strategy
- Engagement dashboard layout, charts, and metric calculations
- MilestoneStatus enum migration strategy (extending existing enum)
- Auto-completion detection trigger (on milestone update vs scheduled check)
- Engagement column rendering in existing portfolio table

### Deferred Ideas (OUT OF SCOPE)

- Reminder/notification engine for upcoming milestones and overdue items -- Phase 24
- Client-to-client collaboration on shared action items
- Integration with external project management tools
- AI-powered stall detection and re-engagement suggestions
- Bulk milestone operations for advisors managing many clients
- Export engagement metrics to PDF reports -- Phase 25

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFECYCLE-02 | Optional client engagement and implementation tracking with milestone management, activity feed, and engagement dashboard | All 12 decisions (D-01 through D-12) map directly to this requirement. Existing SolutionMilestone, SolutionActivity, and ProgressDashboard provide foundation. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Enterprise feature flag | Database / Storage | API / Backend | Boolean on AdvisorEnterprise model, checked at query time |
| Milestone status extension (BLOCKED/DEFERRED) | API / Backend | Database / Storage | Enum migration + lifecycle logic in solution-lifecycle.ts |
| Auto-completion detection | API / Backend | -- | Trigger after milestone update within same transaction |
| Activity feed query | API / Backend | -- | Server action aggregating SolutionActivity rows per client |
| Activity feed UI | Browser / Client | -- | React component consuming server-fetched data |
| Engagement column (portfolio) | Frontend Server (SSR) | Database / Storage | RSC data fetch + inline rendering in existing table |
| Engagement dashboard page | Frontend Server (SSR) | Browser / Client | SSR for data, client for charts/filters |
| "Publish" mechanism | API / Backend | Database / Storage | Server action setting publish flag on Action Plan |
| Next Step callout | Browser / Client | API / Backend | Component logic selecting highest-urgency incomplete milestone |
| Milestone progress bars | Browser / Client | -- | Calculation from existing milestone data already fetched |

## Standard Stack

### Core (already in project)

| Library | Purpose | Why Standard |
|---------|---------|--------------|
| Prisma 7 | Schema migration for enum extension, feature flag fields | Already used for all DB access |
| Next.js (App Router) | SSR pages for dashboard, RSC for engagement data | Project standard |
| Zod | Schema validation for new server actions | Established pattern in guidance-schemas.ts |
| TanStack React Table | Portfolio table engagement column | Already used in RecommendationsPortfolio |
| Recharts | Engagement dashboard charts | Already in project for analytics |
| date-fns | Date formatting in activity feed and dashboards | Already imported in existing components |
| lucide-react | Icons for milestone statuses, activity types | Project standard icon library |
| shadcn/ui | Card, Badge, Progress, Collapsible for new UI | Project standard component library |

### No New Dependencies

This phase requires zero new npm packages. All functionality builds on existing libraries.

## Architecture Patterns

### System Architecture Diagram

```
Advisor publishes Action Plan
        |
        v
[Server Action: publishActionPlan()]
        |
        +--> Set "published" flag on recommendation set
        +--> Log SolutionActivity "action_plan_published"
        |
        v
[Enterprise Feature Flag Check]
        |
        +--> implementationTrackingEnabled = false? --> Stop (zero noise)
        +--> implementationTrackingEnabled = true?
                |
                v
        [Tracking surfaces activate]
                |
        +-------+-------+-------+
        |       |       |       |
        v       v       v       v
  Milestone   Activity  Engagement  Portfolio
  Controls    Feed      Dashboard   Column
  (advisor)   (SAP page) (new page) (existing table)
        |       |
        v       v
  [updateMilestoneStatus()]  [getClientActivityFeed()]
        |                           |
        +--> Auto-completion        +--> SolutionActivity query
        |    check                       filtered by client's
        |                               recommendation IDs
        v
  [transitionRecommendationStatus() -> COMPLETED]
```

### Recommended Project Structure

```
src/
├── lib/
│   ├── engagement/
│   │   ├── feature-flags.ts          # Enterprise flag check helpers
│   │   ├── activity-feed.ts          # Activity feed query + types
│   │   ├── engagement-metrics.ts     # Aggregation queries for dashboard
│   │   └── publish-action-plan.ts    # Publish mechanism logic
│   ├── recommendations/
│   │   └── solution-lifecycle.ts     # Extend: BLOCKED/DEFERRED + auto-completion
│   └── actions/
│       ├── engagement-actions.ts     # Server actions for milestone mgmt + publish
│       └── guidance-schemas.ts       # Extend with milestone block/defer schemas
├── components/
│   ├── action-plan/
│   │   ├── ProgressDashboard.tsx     # Extend: milestone-level progress + Next Step
│   │   ├── ActivityFeed.tsx          # New: inline collapsible feed
│   │   └── NextStepCallout.tsx       # New: urgent milestone highlight
│   └── engagement/
│       ├── EngagementDashboard.tsx    # New: advisor analytics page
│       ├── EngagementMetrics.tsx      # New: completion rates, stalled clients
│       └── MilestoneStatusBadge.tsx   # New: status badges including BLOCKED/DEFERRED
└── app/(protected)/
    └── advisor/
        ├── engagement/
        │   └── page.tsx              # New: engagement dashboard page
        └── clients/[clientId]/
            └── guidance/page.tsx     # Extend: activity feed integration
```

### Pattern 1: Enterprise Feature Flag

**What:** Boolean field on `AdvisorEnterprise` model controlling implementation tracking visibility.

**When to use:** Every UI surface and API endpoint in this phase checks the flag before rendering tracking features.

**Implementation approach:**

```typescript
// src/lib/engagement/feature-flags.ts
export async function isImplementationTrackingEnabled(
  advisorProfileId: string
): Promise<boolean> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      enterprise: {
        select: { implementationTrackingEnabled: true },
      },
    },
  });
  // Solo advisors (no enterprise) default to enabled
  // Enterprise advisors check their firm's flag
  return profile?.enterprise?.implementationTrackingEnabled ?? true;
}
```

[ASSUMED] -- placement on `AdvisorEnterprise` vs. `Subscription` model is discretionary. Enterprise model is recommended because the flag is per-firm, not per-billing-plan. The Subscription model already has branding flags, but those are tier-gated; this is an on/off toggle per firm.

### Pattern 2: Activity Feed Query

**What:** Single-stream per-client activity feed from existing `SolutionActivity` table.

**When to use:** D-04 requires a chronological timeline aggregated across all of a client's recommendations.

**Implementation approach:**

```typescript
// Query all activities for a client's recommendations
const activities = await prisma.solutionActivity.findMany({
  where: {
    assessmentRecommendation: {
      assessment: {
        userId: clientId,
        status: "COMPLETED",
      },
    },
  },
  include: {
    assessmentRecommendation: {
      select: {
        serviceRecommendation: { select: { name: true } },
      },
    },
  },
  orderBy: { createdAt: "desc" },
  take: limit,
  skip: offset,
});
```

[VERIFIED: codebase] -- SolutionActivity model already has `@@index([assessmentRecommendationId, createdAt])`. The join path `SolutionActivity -> AssessmentRecommendation -> Assessment -> userId` is supported by existing relations.

### Pattern 3: Auto-Completion Detection

**What:** After every milestone status update, check if all milestones for that recommendation are terminal (COMPLETED, SKIPPED, or DEFERRED). If so, auto-transition the recommendation to COMPLETED.

**When to use:** D-12 requires this on every milestone update.

**Implementation approach:** Hook into `updateMilestoneStatus()` in `solution-lifecycle.ts`:

```typescript
// After milestone update, within same transaction:
const allMilestones = await tx.solutionMilestone.findMany({
  where: { assessmentRecommendationId: milestone.assessmentRecommendationId },
  select: { status: true },
});

const terminalStatuses = ["COMPLETED", "SKIPPED", "DEFERRED"];
const allTerminal = allMilestones.every(m => terminalStatuses.includes(m.status));
const anyBlocked = allMilestones.some(m => m.status === "BLOCKED");

if (allTerminal && !anyBlocked) {
  // Auto-complete the recommendation
  await tx.assessmentRecommendation.update({
    where: { id: milestone.assessmentRecommendationId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await tx.solutionActivity.create({
    data: {
      assessmentRecommendationId: milestone.assessmentRecommendationId,
      actorId: input.actorId,
      action: "auto_completed",
      detail: { reason: "all_milestones_terminal" },
    },
  });
}
```

[VERIFIED: codebase] -- `updateMilestoneStatus()` already uses `prisma.$transaction`, so adding the check within the same transaction is natural.

### Pattern 4: Publish Mechanism

**What:** The "publish" action that activates tracking for a client's recommendations.

**When to use:** D-02 says tracking auto-activates when the advisor publishes a Strategic Action Plan.

**Recommendation:** Add a `publishedAt` field to `Assessment` (or use a dedicated `ActionPlanPublication` model). When the advisor clicks "Publish Action Plan," set this timestamp. All tracking UI surfaces check `publishedAt IS NOT NULL` before rendering.

[ASSUMED] -- Whether to use an existing field (e.g., `deliverablePhase = PORTFOLIO`) or a new `publishedAt` timestamp is discretionary. A new timestamp is cleaner because it decouples from the legacy deliverable phase system and enables future "unpublish" capability.

### Anti-Patterns to Avoid

- **Separate polling for auto-completion:** D-12 should trigger inline after milestone update, not via a cron job or separate check. Scheduled checks introduce latency and missed transitions.
- **Per-recommendation activity feeds:** D-04 explicitly says single stream per client. Don't build per-recommendation feeds and then merge them -- query across all recommendations for the client from the start.
- **Feature flag in PlatformSettings:** The flag is per-enterprise, not platform-wide. Don't add it to the singleton `PlatformSettings` model.
- **Rendering empty tracking UI:** D-06 says zero-state means the section does not render. Don't show "No activity yet" cards or empty timelines.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date grouping in feed | Custom date grouper | date-fns `isSameDay`, `format` | Already imported, handles edge cases |
| Progress calculation | Manual percentage math | Derive from milestone counts in query | Avoid floating point edge cases |
| Enum migration | Manual SQL ALTER TYPE | Prisma `npx prisma migrate dev` | Handles PostgreSQL enum extension correctly |
| Timeline UI | Custom timeline component | Adapt `WorkflowTimeline.tsx` pattern | Already exists, proven design pattern |
| Pagination | Custom offset/limit logic | Cursor-based pagination on `createdAt` | SolutionActivity already indexed on `createdAt` |

## Common Pitfalls

### Pitfall 1: PostgreSQL Enum Extension Ordering

**What goes wrong:** Adding values to a PostgreSQL enum via Prisma migration can cause issues if the enum values need specific ordering or if there are CHECK constraints.

**Why it happens:** PostgreSQL's `ALTER TYPE ... ADD VALUE` doesn't support transactional DDL in all cases. Prisma handles this, but manual migration tweaks can break it.

**How to avoid:** Let Prisma generate the migration. Review the SQL to ensure `ALTER TYPE "MilestoneStatus" ADD VALUE 'BLOCKED'` and `ADD VALUE 'DEFERRED'` are present. Don't wrap enum extension in a transaction manually.

**Warning signs:** Migration fails with "cannot add value to enum inside transaction block."

### Pitfall 2: N+1 Queries in Activity Feed

**What goes wrong:** Loading activity feed with recommendation names causes N+1 if each activity triggers a separate query for its parent recommendation's service name.

**Why it happens:** The join path is `SolutionActivity -> AssessmentRecommendation -> ServiceRecommendation`.

**How to avoid:** Use Prisma `include` in a single query (shown in Pattern 2 above). For the portfolio engagement column, use a raw aggregation query rather than loading all milestones per client.

**Warning signs:** Activity feed page load > 500ms on clients with 20+ recommendations.

### Pitfall 3: Race Condition on Auto-Completion

**What goes wrong:** Two concurrent milestone updates could both see "all milestones terminal" and both attempt to transition the recommendation to COMPLETED.

**Why it happens:** If the auto-completion check runs outside a transaction, two parallel updates could read stale state.

**How to avoid:** The check MUST run within the same `$transaction` as the milestone update (Pattern 3). Prisma's default transaction isolation level (Read Committed) is sufficient because the milestone update + check + recommendation update are all in one transaction.

**Warning signs:** Duplicate `auto_completed` activity log entries for the same recommendation.

### Pitfall 4: Breaking Existing Advisor Experience

**What goes wrong:** Advisors who don't use tracking suddenly see engagement columns, activity feeds, or progress tracking UI that wasn't there before.

**Why it happens:** Feature flag check is missing from a rendering path.

**How to avoid:** Every new UI surface must be gated behind two conditions: (1) enterprise `implementationTrackingEnabled` flag, and (2) the action plan has been published (`publishedAt IS NOT NULL`). Components should return `null` when either condition is false.

**Warning signs:** Advisor with no published action plans sees tracking UI elements.

### Pitfall 5: Milestone Due Dates for Next Step Callout

**What goes wrong:** The "Next Step" callout (D-09) requires due dates on milestones, but `SolutionMilestone` currently only has `estimatedDuration` (a string like "2-3 weeks"), not a concrete `dueDate`.

**Why it happens:** The existing model was designed for display, not scheduling.

**How to avoid:** Add an optional `dueDate DateTime?` field to `SolutionMilestone`. The advisor can set due dates when they want to use tracking. The Next Step callout shows the milestone with the earliest due date, or falls back to sort order if no due dates are set.

**Warning signs:** Next Step callout says "Due: 2-3 weeks" instead of a concrete date.

## Code Examples

### Extending updateMilestoneStatus for BLOCKED/DEFERRED

```typescript
// Source: existing solution-lifecycle.ts, extended
export async function updateMilestoneStatus(input: {
  milestoneId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "BLOCKED" | "DEFERRED";
  actorId: string;
  reason?: string;        // Required for BLOCKED
  revisitDate?: Date;     // Optional for DEFERRED
}): Promise<void> {
  const { milestoneId, status, actorId, reason, revisitDate } = input;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const milestone = await tx.solutionMilestone.update({
      where: { id: milestoneId },
      data: {
        status,
        completedAt: status === "COMPLETED" ? now : null,
        blockedReason: status === "BLOCKED" ? reason : null,
        deferredReason: status === "DEFERRED" ? reason : null,
        deferredRevisitDate: status === "DEFERRED" ? revisitDate : null,
      },
    });

    // Log activity
    await tx.solutionActivity.create({
      data: {
        assessmentRecommendationId: milestone.assessmentRecommendationId,
        actorId,
        action: SOLUTION_ACTIONS.MILESTONE_UPDATE,
        detail: { milestoneId, title: milestone.title, status, reason },
      },
    });

    // Auto-completion check (D-12)
    await checkAutoCompletion(tx, milestone.assessmentRecommendationId, actorId);
  });
}
```

### Activity Feed Component Pattern

```typescript
// Source: pattern derived from WorkflowTimeline.tsx
// Activity feed renders only when activities exist (D-06)
export function ActivityFeed({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) return null; // Zero-state: don't render

  return (
    <Collapsible>
      <CollapsibleTrigger>Recent Activity ({activities.length})</CollapsibleTrigger>
      <CollapsibleContent>
        {/* Group by date, render reverse-chronological */}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### Engagement Column Data Query

```typescript
// Aggregation for portfolio engagement column (D-07)
const engagementData = await prisma.assessmentRecommendation.groupBy({
  by: ["assessmentId"],
  where: {
    assessment: {
      userId: { in: clientIds },
      status: "COMPLETED",
    },
    status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
    hiddenFromClient: false,
  },
  _count: { id: true },
});
// Cross-reference with milestone completion counts per assessment
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PortfolioEngagement model (BRD Phase 3) | SolutionMilestone + SolutionActivity (Phase 22) | Phase 22 | Engagement tracking now lives at recommendation level, not assessment level |
| Static playbook steps | Materialized milestones with status tracking | Phase 22 | Milestones are actionable, not just informational |
| Single recommendation status | Dual-track: TaskStatus (client) + MilestoneStatus (advisor) | Phase 22 | Separate ownership tracks already exist |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Feature flag on AdvisorEnterprise model (not Subscription) | Architecture Patterns - Pattern 1 | Low -- easy to move; both models are accessible from advisor queries |
| A2 | New `publishedAt` timestamp on Assessment for publish mechanism | Architecture Patterns - Pattern 4 | Medium -- if existing deliverablePhase PORTFOLIO status is preferred, need to wire differently |
| A3 | LIFECYCLE-02 is the requirement ID (referenced in ROADMAP but not formally defined in REQUIREMENTS.md) | Phase Requirements | Low -- the requirement is implicit from the roadmap description |
| A4 | Solo advisors (no enterprise) default to tracking enabled | Architecture Patterns - Pattern 1 | Low -- can be inverted easily; solo advisors likely want tracking more than enterprise |

## Open Questions

1. **Publish mechanism: new field vs existing deliverablePhase**
   - What we know: `deliverablePhase` enum has PREVIEW, PROFILE, PORTFOLIO values. PORTFOLIO conceptually means "engaged for execution."
   - What's unclear: Whether D-02 "publish" should map to `deliverablePhase = PORTFOLIO` or a new `publishedAt` timestamp.
   - Recommendation: Use a new `actionPlanPublishedAt DateTime?` on Assessment. Cleaner separation, enables publish/unpublish, and doesn't conflate with legacy BRD deliverable phases.

2. **Milestone due dates**
   - What we know: `SolutionMilestone` has `estimatedDuration` (string) but no concrete `dueDate`.
   - What's unclear: Whether D-09 "Next Step callout with due date" requires advisors to set due dates or if the system should calculate them from `estimatedDuration`.
   - Recommendation: Add optional `dueDate DateTime?` to `SolutionMilestone`. Advisors set them when using tracking. Fallback to sort order when no due dates exist.

3. **Engagement dashboard metrics scope**
   - What we know: D-08 wants completion rates, stalled clients, upcoming milestones, overdue items.
   - What's unclear: Exact metric definitions (e.g., what constitutes "stalled" -- no activity in X days?).
   - Recommendation: Define "stalled" as no milestone status change in 14 days for any IN_PROGRESS recommendation. Make the threshold configurable later.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (globals enabled) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFECYCLE-02a | BLOCKED/DEFERRED milestone transitions | unit | `npx vitest run src/lib/recommendations/solution-lifecycle.test.ts -t "BLOCKED"` | Extend existing |
| LIFECYCLE-02b | Auto-completion when all milestones terminal | unit | `npx vitest run src/lib/recommendations/solution-lifecycle.test.ts -t "auto-complete"` | Extend existing |
| LIFECYCLE-02c | Auto-completion blocked by BLOCKED milestone | unit | Same file | Extend existing |
| LIFECYCLE-02d | Activity feed query returns client-scoped results | unit | `npx vitest run src/lib/engagement/activity-feed.test.ts` | Wave 0 |
| LIFECYCLE-02e | Feature flag gates tracking UI | unit | `npx vitest run src/lib/engagement/feature-flags.test.ts` | Wave 0 |
| LIFECYCLE-02f | Engagement metrics aggregation | unit | `npx vitest run src/lib/engagement/engagement-metrics.test.ts` | Wave 0 |
| LIFECYCLE-02g | Publish action plan server action | unit | `npx vitest run src/lib/actions/engagement-actions.test.ts` | Wave 0 |

### Wave 0 Gaps

- [ ] `src/lib/engagement/activity-feed.test.ts` -- activity feed query tests
- [ ] `src/lib/engagement/feature-flags.test.ts` -- feature flag check tests
- [ ] `src/lib/engagement/engagement-metrics.test.ts` -- metrics aggregation tests
- [ ] `src/lib/actions/engagement-actions.test.ts` -- server action tests

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing auth via NextAuth |
| V3 Session Management | no | Existing session management |
| V4 Access Control | yes | requireAdvisorRole + assessment ownership checks (existing pattern) |
| V5 Input Validation | yes | Zod schemas for milestone status, reasons, dates |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client modifying advisor-only milestone status | Elevation of Privilege | Server action checks session role before allowing MilestoneStatus changes |
| Activity feed leaking advisor-internal notes to clients | Information Disclosure | D-05: role-filtered query excludes advisor-only activity types |
| Cross-client activity feed access | Information Disclosure | Query filters by assessment.userId matching session user |
| Feature flag bypass | Tampering | Server-side flag check (not client-side gating) |

## Sources

### Primary (HIGH confidence)
- Codebase: `prisma/schema.prisma` -- SolutionMilestone, SolutionActivity, MilestoneStatus enum, PortfolioEngagement, AdvisorEnterprise models
- Codebase: `src/lib/recommendations/solution-lifecycle.ts` -- transitionRecommendationStatus, updateMilestoneStatus, hydrateMilestones
- Codebase: `src/lib/actions/client-action-plan-actions.ts` -- getClientActionPlan, updateTaskStatus patterns
- Codebase: `src/components/action-plan/ProgressDashboard.tsx` -- existing progress calculation
- Codebase: `src/components/action-plan/ActionCard.tsx` -- task status dropdown, playbook steps display
- Codebase: `src/components/pipeline/WorkflowTimeline.tsx` -- timeline component pattern
- Codebase: `src/components/recommendations/RecommendationsPortfolio.tsx` -- portfolio card pattern
- CONTEXT.md: Decisions D-01 through D-12 and Claude's Discretion areas

### Secondary (MEDIUM confidence)
- STATE.md: Phase dependency chain and accumulated decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all existing libraries
- Architecture: HIGH -- extends existing models and patterns directly
- Pitfalls: HIGH -- derived from actual codebase analysis (enum migration, N+1, transaction safety)

**Research date:** 2026-06-27
**Valid until:** 2026-07-27 (stable -- internal feature on existing infrastructure)
