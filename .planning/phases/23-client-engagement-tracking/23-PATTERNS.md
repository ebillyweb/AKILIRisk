# Phase 23: Client Engagement & Implementation Tracking - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 16 (new/modified)
**Analogs found:** 14 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `prisma/schema.prisma` (migration) | migration | -- | existing schema | exact |
| `src/lib/engagement/feature-flags.ts` | utility | request-response | `src/lib/platform/feature-flags.ts` | exact |
| `src/lib/engagement/activity-feed.ts` | service | CRUD | `src/lib/actions/client-action-plan-actions.ts` | role-match |
| `src/lib/engagement/engagement-metrics.ts` | service | CRUD | `src/lib/actions/client-action-plan-actions.ts` | role-match |
| `src/lib/engagement/publish-action-plan.ts` | service | CRUD | `src/lib/recommendations/solution-lifecycle.ts` | exact |
| `src/lib/recommendations/solution-lifecycle.ts` (modify) | service | CRUD | self | exact |
| `src/lib/actions/engagement-actions.ts` | controller | request-response | `src/lib/actions/client-action-plan-actions.ts` | exact |
| `src/lib/actions/guidance-schemas.ts` (modify) | utility | transform | self | exact |
| `src/components/action-plan/ActivityFeed.tsx` | component | request-response | `src/components/pipeline/WorkflowTimeline.tsx` | exact |
| `src/components/action-plan/NextStepCallout.tsx` | component | transform | `src/components/action-plan/ProgressDashboard.tsx` | role-match |
| `src/components/action-plan/ProgressDashboard.tsx` (modify) | component | transform | self | exact |
| `src/components/action-plan/StrategicActionPlan.tsx` (modify) | component | transform | self | exact |
| `src/components/engagement/EngagementDashboard.tsx` | component | request-response | `src/components/analytics/GovernanceTrendChart.tsx` (via analytics page) | role-match |
| `src/components/engagement/EngagementMetrics.tsx` | component | transform | `src/components/action-plan/ProgressDashboard.tsx` | role-match |
| `src/components/engagement/MilestoneStatusBadge.tsx` | component | transform | `src/components/recommendations/RecommendationsPortfolio.tsx` (statusBadgeVariant) | exact |
| `src/app/(protected)/advisor/engagement/page.tsx` | route | request-response | `src/app/(protected)/advisor/analytics/[clientId]/page.tsx` | exact |

## Pattern Assignments

### `src/lib/engagement/feature-flags.ts` (utility, request-response)

**Analog:** `src/lib/platform/feature-flags.ts`

**Imports pattern** (lines 1-3):
```typescript
import "server-only";

import { prisma } from "@/lib/db";
```

**Core pattern** (lines 18-56) -- query a model, return typed boolean flags with safe fallback:
```typescript
export async function getPlatformFeatureFlags(): Promise<AdvisorPlatformFeatureFlags> {
  const delegate = prisma.platformSettings as
    | typeof prisma.platformSettings
    | undefined;
  if (!delegate?.findUnique) {
    console.warn(
      "[feature-flags] PlatformSettings unavailable ...",
    );
    return { /* defaults */ };
  }

  let row = await delegate.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });

  if (!row) {
    row = await delegate.create({ data: { /* defaults */ } });
  }

  return { /* mapped flags */ };
}
```

**Key difference:** Phase 23 flag is per-enterprise (not singleton). Query `AdvisorEnterprise` by advisor profile, not `PlatformSettings` by fixed ID. Return `true` when no enterprise row exists (solo advisor default).

---

### `src/lib/engagement/activity-feed.ts` (service, CRUD)

**Analog:** `src/lib/actions/client-action-plan-actions.ts`

**Imports pattern** (lines 1-6):
```typescript
import "server-only"; // if not a server action file, use this instead of "use server"

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
```

**Query pattern** (lines 161-194) -- Prisma findMany with nested includes and orderBy:
```typescript
const recs = await prisma.assessmentRecommendation.findMany({
  where: {
    assessment: {
      userId: session.user.id,
      status: "COMPLETED",
    },
    status: { in: ["INCLUDED", "IN_PROGRESS", "COMPLETED"] },
    hiddenFromClient: false,
  },
  include: {
    serviceRecommendation: {
      select: { id: true, name: true, /* ... */ },
    },
    milestones: {
      select: { title: true, description: true, /* ... */ },
      orderBy: { sortOrder: "asc" },
    },
  },
  orderBy: [{ urgencyScore: "desc" }, { priority: "asc" }],
});
```

**Activity feed query path:** `SolutionActivity -> AssessmentRecommendation -> Assessment -> userId`. Use `include` to join recommendation name in one query (avoid N+1).

---

### `src/lib/engagement/publish-action-plan.ts` (service, CRUD)

**Analog:** `src/lib/recommendations/solution-lifecycle.ts`

**Transaction + activity log pattern** (lines 96-173):
```typescript
await prisma.$transaction(async (tx) => {
  const current = await tx.assessmentRecommendation.findUniqueOrThrow({
    where: { id: recommendationId },
    select: { status: true },
  });

  // ... validation ...

  await tx.assessmentRecommendation.update({
    where: { id: recommendationId },
    data,
  });

  // Log activity with from/to
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
});
```

---

### `src/lib/recommendations/solution-lifecycle.ts` (modify -- BLOCKED/DEFERRED + auto-completion)

**Existing `updateMilestoneStatus`** (lines 281-311) -- extend this function:
```typescript
export async function updateMilestoneStatus(input: {
  milestoneId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  actorId: string;
}): Promise<void> {
  const { milestoneId, status, actorId } = input;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const milestone = await tx.solutionMilestone.update({
      where: { id: milestoneId },
      data: {
        status,
        completedAt: status === "COMPLETED" ? now : null,
      },
    });

    await tx.solutionActivity.create({
      data: {
        assessmentRecommendationId: milestone.assessmentRecommendationId,
        actorId,
        action: SOLUTION_ACTIONS.MILESTONE_UPDATE,
        detail: { milestoneId, title: milestone.title, status },
      },
    });
  });
}
```

**Extend with:** Add `"BLOCKED" | "DEFERRED"` to status union. Add `reason?: string`, `revisitDate?: Date` to input. Add `blockedReason`/`deferredReason`/`deferredRevisitDate` to update data. Add auto-completion check after activity log within same transaction.

**State machine pattern** (lines 15-27) -- `ALLOWED_TRANSITIONS` record. Add `IN_PROGRESS: ["COMPLETED"]` transition from auto-completion. The `InvalidTransitionError` class (lines 29-34) is the error pattern.

**Action constants pattern** (lines 40-52) -- add `AUTO_COMPLETED: "auto_completed"`, `MILESTONE_BLOCKED: "milestone_blocked"`, `MILESTONE_DEFERRED: "milestone_deferred"`.

---

### `src/lib/actions/engagement-actions.ts` (controller, request-response)

**Analog:** `src/lib/actions/client-action-plan-actions.ts`

**Server action pattern** (lines 1-2, 62-113):
```typescript
"use server";

export async function updateTaskStatus(
  input: TaskStatusInput
): Promise<ActionResult<void>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return fail("Not authenticated");
    }

    const parsed = taskStatusSchema.parse(input);

    // Verify ownership
    const rec = await prisma.assessmentRecommendation.findUnique({ /* ... */ });
    if (!rec) return fail("Recommendation not found");
    if (rec.assessment.userId !== session.user.id) {
      return fail("Not authorized to update this recommendation");
    }

    // ... mutation ...

    revalidate();
    return ok(undefined);
  } catch (err) {
    logSafeError("updateTaskStatus", err);
    return fail(safeErrorMessage(err, "Failed to update task status"));
  }
}
```

**ActionResult type** (lines 37-47):
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function fail(error: string): ActionResult<never> {
  return { success: false, error };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}
```

**For advisor actions, use `requireAdvisorRole` instead of session check:**
```typescript
import { requireAdvisorRole } from "@/lib/advisor/auth";
const { userId } = await requireAdvisorRole();
```

---

### `src/lib/actions/guidance-schemas.ts` (modify -- add milestone block/defer schemas)

**Existing schema pattern** (lines 10-28):
```typescript
import { z } from "zod";

export const deferSchema = z.object({
  recommendationId: z.string().cuid(),
  reason: z.string().min(1).max(500),
  revisitDate: z.string().datetime().optional(),
  triggerEvent: z.string().max(300).optional(),
  notes: z.string().max(2000).optional(),
});
export type DeferInput = z.infer<typeof deferSchema>;
```

**Add:** `milestoneBlockSchema` (milestoneId + reason required), `milestoneDeferSchema` (milestoneId + reason + optional revisitDate), `publishActionPlanSchema` (assessmentId).

---

### `src/components/action-plan/ActivityFeed.tsx` (component, request-response)

**Analog:** `src/components/pipeline/WorkflowTimeline.tsx`

**Imports pattern** (lines 1-5):
```typescript
"use client";

import { format } from "date-fns";
```

**Timeline structure** (lines 40-94) -- dot + connector line + content:
```typescript
<div className="space-y-6">
  {sortedEvents.map((event, index) => (
    <div key={`${event.stage}-${event.date.getTime()}`} className="relative flex items-start space-x-4">
      {/* Timeline line */}
      {index < sortedEvents.length - 1 && (
        <div className="absolute left-4 top-8 w-0.5 h-16 bg-gray-200" />
      )}

      {/* Timeline dot */}
      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
        {/* ... */}
      </div>

      {/* Event content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground">{event.label}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {format(event.date, 'MMM d, yyyy h:mm a')}
        </p>
        {event.detail && (
          <p className="text-sm text-muted-foreground mt-2">{event.detail}</p>
        )}
      </div>
    </div>
  ))}
</div>
```

**Key adaptation:** Wrap in `Collapsible` from shadcn/ui (see ActionCard.tsx lines 221-258 for collapsible pattern). Return `null` when `activities.length === 0` per D-06.

**Collapsible pattern** (from `ActionCard.tsx` lines 221-230):
```typescript
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

<Collapsible open={guidanceOpen} onOpenChange={setGuidanceOpen}>
  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:bg-muted/40">
    <span>Implementation Guidance ({item.playbookSteps.length} steps)</span>
    <ChevronDown className={`h-4 w-4 transition-transform ${guidanceOpen ? "rotate-180" : ""}`} />
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* content */}
  </CollapsibleContent>
</Collapsible>
```

---

### `src/components/action-plan/NextStepCallout.tsx` (component, transform)

**Analog:** `src/components/action-plan/ProgressDashboard.tsx`

**Component pattern** (lines 1-8, 27-29):
```typescript
"use client";

import { Progress } from "@/components/ui/progress";
import type { ActionPlanItem } from "@/lib/actions/client-action-plan-actions";

type ProgressDashboardProps = { items: ActionPlanItem[] };

export function ProgressDashboard({ items }: ProgressDashboardProps) {
  if (items.length === 0) return null;
  // ...
```

**Key pattern:** Return `null` when no data. Pure presentational component receiving pre-fetched data via props.

---

### `src/components/engagement/MilestoneStatusBadge.tsx` (component, transform)

**Analog:** `src/components/recommendations/RecommendationsPortfolio.tsx`

**Badge variant pattern** (lines 9-23):
```typescript
function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "success" | "warning" {
  switch (status) {
    case "PENDING":
      return "warning";
    case "ACCEPTED":
    case "COMPLETED":
      return "success";
    case "DECLINED":
      return "outline";
    default:
      return "secondary";
  }
}

// Usage:
<Badge variant={statusBadgeVariant(rec.status)} className="h-5 text-[10px]">
  {rec.status.toLowerCase()}
</Badge>
```

**Extend for:** BLOCKED (destructive/warning), DEFERRED (outline), IN_PROGRESS (default), NOT_STARTED (secondary), SKIPPED (outline).

---

### `src/app/(protected)/advisor/engagement/page.tsx` (route, request-response)

**Analog:** `src/app/(protected)/advisor/analytics/[clientId]/page.tsx`

**SSR page with Suspense pattern** (lines 1-5, 84-123):
```typescript
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { clientId } = await params;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="mb-8">
        <Link href="/advisor/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Category</p>
          <h1 className="text-3xl font-bold tracking-tight">Page Title</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">Description</p>
        </div>
      </div>

      <Suspense fallback={
        <div className="text-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }>
        <ContentComponent />
      </Suspense>
    </div>
  );
}
```

**Auth pattern** (from guidance page, lines 9-46):
```typescript
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { prisma } from "@/lib/db";

export default async function Page({ params }) {
  const { userId } = await requireAdvisorRole();

  const advisorProfile = await prisma.advisorProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!advisorProfile) redirect("/advisor");

  // ... data loading ...
}
```

---

### `src/components/action-plan/StrategicActionPlan.tsx` (modify)

**Existing composition** (lines 12-47):
```typescript
export function StrategicActionPlan({ data }: StrategicActionPlanProps) {
  const allItems = [...data.immediate, ...data.strategic, ...data.ongoing];

  return (
    <div className="space-y-12">
      <ExecutiveSummary items={allItems} />
      <TimeHorizonSection heading="Immediate Priorities" /* ... */ />
      <TimeHorizonSection heading="Strategic Initiatives" /* ... */ />
      <TimeHorizonSection heading="Ongoing Practices" /* ... */ />
      <ProgressDashboard items={allItems} />
    </div>
  );
}
```

**Extend:** Add `<ActivityFeed />` and `<NextStepCallout />` components. ActivityFeed only renders when activities exist (D-06). Both gated behind `publishedAt` and feature flag.

---

## Shared Patterns

### Authentication (Advisor Server Actions)
**Source:** `src/lib/advisor/auth.ts` lines 193-219
**Apply to:** `engagement-actions.ts`, engagement dashboard page

```typescript
import { requireAdvisorRole } from "@/lib/advisor/auth";

const { userId } = await requireAdvisorRole();
```

### Authentication (Client Server Actions)
**Source:** `src/lib/actions/client-action-plan-actions.ts` lines 66-69
**Apply to:** Any client-facing engagement actions

```typescript
const session = await auth();
if (!session?.user?.id) {
  return fail("Not authenticated");
}
```

### Error Handling (Server Actions)
**Source:** `src/lib/actions/client-action-plan-actions.ts` lines 37-47, 109-112
**Apply to:** All server action files

```typescript
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// In catch block:
logSafeError("functionName", err);
return fail(safeErrorMessage(err, "Human-readable fallback"));
```

### Transactional Activity Logging
**Source:** `src/lib/recommendations/solution-lifecycle.ts` lines 96-173
**Apply to:** `publish-action-plan.ts`, `updateMilestoneStatus` extension

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Read current state
  // 2. Validate transition
  // 3. Update entity
  // 4. Log SolutionActivity
  // 5. Side effects (auto-completion check)
});
```

### Zod Schema Validation
**Source:** `src/lib/actions/guidance-schemas.ts` lines 10-28
**Apply to:** All new schemas in `guidance-schemas.ts`

```typescript
export const someSchema = z.object({
  recommendationId: z.string().cuid(),
  reason: z.string().min(1).max(500),
  revisitDate: z.string().datetime().optional(),
});
export type SomeInput = z.infer<typeof someSchema>;
```

### Zero-state Component Rendering
**Source:** `src/components/action-plan/ProgressDashboard.tsx` line 28
**Apply to:** ActivityFeed, NextStepCallout, engagement column

```typescript
export function Component({ items }: Props) {
  if (items.length === 0) return null;
  // ...
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/engagement/EngagementDashboard.tsx` | component | request-response | No portfolio-level analytics dashboard with completion rates, stalled clients, overdue items exists. Closest is analytics page for single-client trend charts, but engagement dashboard is multi-client aggregate. Use Recharts (already in project) and Card/Badge from shadcn/ui. |
| `src/components/engagement/EngagementMetrics.tsx` | component | transform | No multi-client aggregation metrics component exists. Build from ProgressDashboard pattern (percentage calculations, Progress component) but scope to advisor portfolio. |

## Metadata

**Analog search scope:** `src/lib/`, `src/components/`, `src/app/(protected)/advisor/`
**Files scanned:** ~30 (targeted by canonical refs + glob)
**Pattern extraction date:** 2026-06-27
