# Phase 24: Continuous Risk Improvement - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 14 (new/modified)
**Analogs found:** 12 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/reassessment/create-reassessment.ts` | service | CRUD | `src/lib/assessment/assessment-completion.ts` | exact |
| `src/lib/reassessment/targeted-followup.ts` | service | transform | `src/lib/recommendations/guidance-package.ts` | role-match |
| `src/lib/reassessment/score-delta.ts` | service | transform | `src/lib/analytics/queries.ts` | exact |
| `src/lib/reassessment/types.ts` | model | N/A | `src/lib/analytics/types.ts` | exact |
| `src/lib/actions/reassessment-actions.ts` | controller | request-response | `src/lib/actions/engagement-actions.ts` | exact |
| `src/lib/cadence/cadence-engine.ts` | service | batch | `src/lib/engagement/engagement-metrics.ts` | role-match |
| `src/lib/cadence/cadence-types.ts` | model | N/A | `src/lib/analytics/types.ts` | role-match |
| `src/app/api/cron/review-cadence/route.ts` | route | batch | `src/app/api/cron/workflow-reminders/route.ts` | exact |
| `src/lib/intelligence/timeline-events.ts` | service | event-driven | `src/lib/recommendations/solution-lifecycle.ts` | exact |
| `src/components/reassessment/ScoreDeltaCard.tsx` | component | request-response | `src/components/analytics/AssessmentComparisonView.tsx` | exact |
| `src/components/reassessment/PillarDeltaGrid.tsx` | component | request-response | `src/components/analytics/CategoryBreakdownChart.tsx` | role-match |
| `src/components/reassessment/ReassessmentCTA.tsx` | component | request-response | `src/components/analytics/TrendIndicator.tsx` | role-match |
| `src/components/timeline/IntelligenceTimeline.tsx` | component | request-response | `src/components/analytics/AssessmentComparisonView.tsx` | role-match |
| `prisma/migrations/*/migration.sql` | migration | N/A | existing schema fields | exact |

## Pattern Assignments

### `src/lib/actions/reassessment-actions.ts` (controller, request-response)

**Analog:** `src/lib/actions/engagement-actions.ts`

**Imports + boilerplate** (lines 1-45):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}
```

**Zod schema pattern** (from `src/lib/actions/guidance-schemas.ts` lines 10-19):
```typescript
import { z } from "zod";

export const includeSchema = z.object({
  recommendationIds: z.array(z.string().cuid()).min(1).max(100),
});
export type IncludeInput = z.infer<typeof includeSchema>;
```

**Ownership verification** (lines 52-90):
```typescript
async function verifyMilestoneOwnership(
  milestoneId: string,
  userId: string
): Promise<{ valid: boolean; error?: string }> {
  // Prisma query through relations to verify advisor owns the resource
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId, advisor: { userId }, status: "ACTIVE" },
  });
  if (!assignment) return { valid: false, error: "Not authorized..." };
  return { valid: true };
}
```

**Action body pattern** (lines 129-151):
```typescript
export async function updateMilestoneStatusAction(
  input: MilestoneStatusInput
): Promise<ActionResult<void>> {
  try {
    const { userId } = await requireAdvisorRole();
    const parsed = milestoneStatusSchema.parse(input);
    const ownership = await verifyMilestoneOwnership(parsed.milestoneId, userId);
    if (!ownership.valid) return fail(ownership.error!);
    await updateMilestoneStatus({ ... });
    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateMilestoneStatusAction", err);
    return fail(safeErrorMessage(err, "Failed to update milestone status"));
  }
}
```

---

### `src/lib/reassessment/create-reassessment.ts` (service, CRUD)

**Analog:** `src/lib/assessment/assessment-completion.ts`

**Transaction pattern** (lines 17-55):
```typescript
import type { Prisma } from "@prisma/client";
type Tx = Prisma.TransactionClient;

export async function syncAssessmentCompletionStatus(
  tx: Tx,
  assessmentId: string
): Promise<{ allPillarsScored: boolean }> {
  const assessment = await tx.assessment.findUnique({ ... });
  await tx.assessment.update({
    where: { id: assessmentId },
    data: allPillarsScored
      ? { status: "COMPLETED", completedAt: now }
      : { status: "IN_PROGRESS", completedAt: null },
  });
  return { allPillarsScored };
}
```

**Assessment creation with versioning** -- extend from `src/lib/actions/admin-rescore-actions.ts` (lines 285-343):
```typescript
const rescoredAt = new Date();
const newVersion = (assessment.version ?? 1) + 1;

await prisma.$transaction(async (tx) => {
  // upsert pillar scores
  // bump version
  await tx.assessment.update({
    where: { id: assessmentId },
    data: { version: newVersion, lastRescoredAt: rescoredAt },
  });
});
```

---

### `src/lib/reassessment/score-delta.ts` (service, transform)

**Analog:** `src/lib/analytics/queries.ts`

**Score comparison pattern** (lines 55-69):
```typescript
function getTrendDirection(
  currentScore: number,
  previousScore: number | null
): 'improving' | 'declining' | 'stable' | 'new' {
  if (previousScore === null) return 'new';
  const difference = currentScore - previousScore;
  if (difference > 0.3) return 'improving';
  if (difference < -0.3) return 'declining';
  return 'stable';
}
```

**Multi-assessment PillarScore query** (lines 100-112):
```typescript
const assessments = await prisma.assessment.findMany({
  where: { userId: clientId, status: 'COMPLETED' },
  include: { scores: true },
  orderBy: { completedAt: 'asc' },
});
```

**Per-pillar breakdown** (lines 130-137):
```typescript
const categories: CategoryBreakdownPoint[] = assessment.scores.map(score => ({
  categoryId: score.pillar,
  categoryName: CATEGORY_LABELS[score.pillar] || score.pillar,
  score: score.score,
  weight: PILLAR_WEIGHTS[score.pillar as keyof typeof PILLAR_WEIGHTS] || 0,
}));
```

---

### `src/lib/intelligence/timeline-events.ts` (service, event-driven)

**Analog:** `src/lib/recommendations/solution-lifecycle.ts`

**Action constants** (lines 40-56):
```typescript
export const SOLUTION_ACTIONS = {
  STATUS_PENDING: "status_pending",
  STATUS_REVIEWED: "status_reviewed",
  // ...
  AUTO_COMPLETED: "auto_completed",
  MILESTONE_BLOCKED: "milestone_blocked",
  MILESTONE_DEFERRED: "milestone_deferred",
} as const;
```

**Activity logging within transaction** (lines 160-171):
```typescript
await tx.solutionActivity.create({
  data: {
    assessmentRecommendationId: recommendationId,
    actorId,
    action: STATUS_ACTION_MAP[newStatus],
    detail: {
      from: current.status,
      to: newStatus,
      ...(reason ? { reason } : {}),
    },
  },
});
```

**Activity feed query with role filtering** (from `src/lib/engagement/activity-feed.ts` lines 43-89):
```typescript
export async function getClientActivityFeed(
  input: ActivityFeedInput,
): Promise<ActivityFeedItem[]> {
  const whereClause: Record<string, unknown> = {
    assessmentRecommendation: {
      assessment: { userId: clientId, status: "COMPLETED" },
    },
  };
  if (role === "CLIENT") {
    whereClause.action = { in: CLIENT_VISIBLE_ACTIONS };
  }
  const activities = await prisma.solutionActivity.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  // ...map to ActivityFeedItem
}
```

---

### `src/app/api/cron/review-cadence/route.ts` (route, batch)

**Analog:** `src/app/api/cron/workflow-reminders/route.ts`

**Cron auth pattern** (lines 17-54):
```typescript
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid authorization header..." }, { status: 401 });
    }
    const providedSecret = authHeader.substring(7);
    const providedBuf = Buffer.from(providedSecret, "utf8");
    const expectedBuf = Buffer.from(expectedSecret, "utf8");
    if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
      return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
    }
    // ... process + return JSON with success, processingTimeMs, timestamp
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}
```

---

### `src/lib/cadence/cadence-engine.ts` (service, batch)

**Analog:** `src/lib/engagement/engagement-metrics.ts`

**Portfolio-wide aggregation query** (lines 47-101):
```typescript
export async function getEngagementMetrics(
  advisorProfileId: string
): Promise<EngagementMetrics> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisorProfileId, status: "ACTIVE" },
    select: { clientId: true },
  });
  const clientIds = assignments.map((a) => a.clientId);
  if (clientIds.length === 0) { return emptyMetrics; }
  // query assessments, milestones, compute metrics
}
```

---

### `src/lib/reassessment/targeted-followup.ts` (service, transform)

**Analog:** `src/lib/recommendations/guidance-package.ts`

**Recommendation-to-assessment linking pattern** (lines 137-169):
```typescript
const assessments = await prisma.assessment.findMany({
  where: { userId: clientId, status: "COMPLETED" },
  select: { id: true, completedAt: true },
  orderBy: { completedAt: "desc" },
});
const assessmentIds = assessments.map((a) => a.id);
const recs = await prisma.assessmentRecommendation.findMany({
  where: { assessmentId: { in: assessmentIds } },
  include: { serviceRecommendation: { select: { ... } } },
  orderBy: { urgencyScore: "desc" },
});
```

---

### `src/components/reassessment/ScoreDeltaCard.tsx` (component, request-response)

**Analog:** `src/components/analytics/AssessmentComparisonView.tsx`

**Side-by-side comparison layout** (lines 31-85):
```typescript
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div className="space-y-4">
    <div className="border-b pb-2">
      <h3 className="text-lg font-medium">Previous Assessment</h3>
      <p className="text-sm text-muted-foreground">
        {format(new Date(previousAssessment.completedAt), 'MMM d, yyyy')}
      </p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-2xl font-bold">{score.toFixed(1)}</span>
        <TrendIndicator direction={trendDirection} />
      </div>
    </div>
  </div>
</div>
```

**TrendIndicator badge pattern** (from `src/components/analytics/TrendIndicator.tsx`):
```typescript
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
// direction-to-variant mapping, direction-to-icon, direction-to-text
// Custom color classes for improving/declining states
```

**ChartContainer card pattern** (from `src/components/analytics/ChartContainer.tsx`):
```typescript
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ResponsiveContainer } from 'recharts';
<Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader>
  <CardContent><ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer></CardContent>
</Card>
```

---

### `src/lib/engagement/feature-flags.ts` -- extend for Phase 24

**Enterprise feature flag pattern** (lines 1-29):
```typescript
import "server-only";
import { prisma } from "@/lib/db";

export async function isImplementationTrackingEnabled(
  advisorProfileId: string,
): Promise<boolean> {
  const profile = await prisma.advisorProfile.findUnique({
    where: { id: advisorProfileId },
    select: {
      enterprise: { select: { implementationTrackingEnabled: true } },
    },
  });
  if (!profile) return false;
  return profile.enterprise?.implementationTrackingEnabled ?? true;
}
```

---

### SSR page with Suspense (dashboard pages)

**Analog:** `src/app/(protected)/advisor/analytics/[clientId]/page.tsx`

**Page structure** (lines 1-123):
```typescript
import { Suspense } from 'react';
import Link from 'next/link';

async function AnalyticsContent({ clientId }: { clientId: string }) {
  const result = await getFamilyAnalyticsData(clientId);
  if (!result.success) {
    return (<div className="text-center py-12"><h2 className="text-lg font-semibold text-destructive mb-2">Error</h2></div>);
  }
  // ... render cards, charts
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { clientId } = await params;
  return (
    <div className="container mx-auto px-4 py-8">
      <Suspense fallback={<LoadingSkeleton />}>
        <AnalyticsContent clientId={clientId} />
      </Suspense>
    </div>
  );
}
```

## Shared Patterns

### Authentication / Role Guards
**Source:** `src/lib/advisor/auth.ts` (`requireAdvisorRole`)
**Apply to:** All reassessment actions, cadence engine actions
```typescript
const { userId } = await requireAdvisorRole();
```

### Error Handling
**Source:** `src/lib/log-safe-error.ts`
**Apply to:** All server actions and service functions
```typescript
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
// in catch:
logSafeError("functionName", err);
return fail(safeErrorMessage(err, "Human-readable fallback"));
```

### Prisma Transactions
**Source:** `src/lib/recommendations/solution-lifecycle.ts` (lines 100-177)
**Apply to:** Reassessment creation (atomic Assessment + PillarScore + SolutionActivity)
```typescript
type TxClient = Prisma.TransactionClient;
await prisma.$transaction(async (tx) => {
  // all reads and writes use tx, not prisma
});
```

### Activity Logging
**Source:** `src/lib/recommendations/solution-lifecycle.ts` (lines 40-56, 160-171)
**Apply to:** All intelligence timeline events
```typescript
// Extend SOLUTION_ACTIONS with new Phase 24 event types:
// ASSESSMENT_STARTED, ASSESSMENT_COMPLETED, SCORE_CALCULATED,
// REASSESSMENT_TRIGGERED, SCORE_CHANGE, RISK_LEVEL_TRANSITION,
// CADENCE_DUE, CADENCE_OVERDUE, CADENCE_CHANGED,
// RECOMMENDATION_IMPACT, EFFECTIVENESS_RATED
await tx.solutionActivity.create({
  data: {
    assessmentRecommendationId,
    actorId,
    action: "new_action_type",  // varchar(60) -- no schema change needed
    detail: { /* structured JSON */ },
  },
});
```

### Revalidation
**Source:** `src/lib/actions/engagement-actions.ts` (lines 42-45)
**Apply to:** All server actions that modify assessment or cadence data
```typescript
revalidatePath("/advisor");
revalidatePath("/dashboard/action-plan");
```

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/lib/cadence/cadence-types.ts` | model | N/A | New domain concept (review cadence scheduling); use `src/lib/analytics/types.ts` structure as template |
| `src/components/timeline/IntelligenceTimeline.tsx` | component | request-response | Extends activity feed UI; no existing timeline component exists, but `AssessmentComparisonView` layout is closest structural analog |

## Metadata

**Analog search scope:** `src/lib/actions/`, `src/lib/assessment/`, `src/lib/engagement/`, `src/lib/recommendations/`, `src/lib/analytics/`, `src/components/analytics/`, `src/app/api/cron/`, `prisma/schema.prisma`
**Files scanned:** 35+
**Pattern extraction date:** 2026-06-27
