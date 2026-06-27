# Phase 22: Recommendation Experience - Pattern Map

**Mapped:** 2026-06-26
**Files analyzed:** 22 new/modified files
**Analogs found:** 18 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/recommendations/guidance-package.ts` | service | CRUD (aggregation) | `src/lib/recommendations/queries.ts` | exact |
| `src/lib/recommendations/override-policy.ts` | utility | transform | `src/lib/recommendations/compose-solution.ts` | role-match |
| `src/lib/recommendations/compose-solution.ts` | service | transform | *self (extend)* | exact |
| `src/lib/recommendations/solution-lifecycle.ts` | service | CRUD | *self (extend)* | exact |
| `src/lib/recommendations/solution-queries.ts` | service | CRUD | *self (extend)* | exact |
| `src/lib/recommendations/types.ts` | types | -- | *self (extend)* | exact |
| `src/lib/asset-catalog/inheritance-engine.ts` | service | transform | `src/lib/recommendations/compose-solution.ts` | role-match |
| `src/lib/asset-catalog/types.ts` | types | -- | `src/lib/recommendations/types.ts` | exact |
| `src/lib/actions/guidance-actions.ts` | controller | request-response | `src/lib/actions/admin-recommendation-actions.ts` | exact |
| `src/lib/actions/enterprise-solution-actions.ts` | controller | request-response | `src/lib/actions/enterprise-recommendation-actions.ts` | exact |
| `src/lib/actions/client-action-plan-actions.ts` | controller | request-response | `src/lib/actions/enterprise-recommendation-actions.ts` | role-match |
| `src/app/(protected)/advisor/clients/[clientId]/guidance/page.tsx` | route | request-response | `src/app/(protected)/advisor/recommendations/page.tsx` | exact |
| `src/app/(protected)/advisor/enterprise/guidance/page.tsx` | route | request-response | `src/app/(protected)/advisor/enterprise/recommendations/page.tsx` | exact |
| `src/app/(protected)/dashboard/action-plan/page.tsx` | route | request-response | `src/app/(protected)/dashboard/page.tsx` | role-match |
| `src/components/guidance/GuidanceReviewPage.tsx` | component | request-response | `src/components/recommendations/RecommendationsPortfolio.tsx` | role-match |
| `src/components/guidance/RecommendationCard.tsx` | component | request-response | `src/components/assessment/FacilitatedRecommendations.tsx` | role-match |
| `src/components/guidance/EvidenceAccordion.tsx` | component | request-response | `src/components/assessment/FacilitatedRecommendations.tsx` | partial |
| `src/components/guidance/DeferDialog.tsx` | component | request-response | shadcn Dialog pattern | no-analog |
| `src/components/guidance/BulkActionBar.tsx` | component | request-response | -- | no-analog |
| `src/components/guidance/GuidanceSummaryStrip.tsx` | component | request-response | `src/components/recommendations/RecommendationsSummaryStrip.tsx` | exact |
| `src/components/enterprise/GuidanceCustomization.tsx` | component | request-response | `src/components/recommendations/RecommendationsPortfolio.tsx` | partial |
| `src/components/action-plan/StrategicActionPlan.tsx` | component | request-response | `src/components/assessment/FacilitatedRecommendations.tsx` | role-match |

## Pattern Assignments

### `src/lib/recommendations/guidance-package.ts` (service, CRUD aggregation)

**Analog:** `src/lib/recommendations/queries.ts`

**Imports pattern** (lines 1-12):
```typescript
import "server-only";

import type { DeliverablePhase, RecommendationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveClientDisplayName } from "@/lib/signals/emit";
import { formatTriggerSummary } from "@/lib/recommendations/format-trigger";
import type {
  ClientRecommendationGroup,
  PortfolioRecommendationItem,
  PortfolioRecommendations,
  PortfolioRecommendationsFilters,
} from "@/lib/recommendations/types";
```

**Core query pattern -- per-advisor client aggregation** (lines 26-73):
```typescript
export async function getPortfolioRecommendations(
  advisorProfileId: string,
  filters: PortfolioRecommendationsFilters = {}
): Promise<PortfolioRecommendations> {
  const assignments = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisorProfileId, status: "ACTIVE" },
    select: { clientId: true },
  });

  const clientIds = assignments.map((a) => a.clientId);
  if (clientIds.length === 0) {
    return { summary: { /* ... */ }, groups: [] };
  }

  const assessments = await prisma.assessment.findMany({
    where: {
      userId: { in: clientIds },
      status: "COMPLETED",
      recommendations: { some: {} },
    },
    include: {
      recommendations: {
        orderBy: { priority: "asc" },
        include: {
          serviceRecommendation: { select: { /* fields */ } },
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  // Deduplicate: keep latest assessment per client
  const latestByClient = new Map<string, (typeof assessments)[number]>();
  for (const assessment of assessments) {
    if (!latestByClient.has(assessment.userId)) {
      latestByClient.set(assessment.userId, assessment);
    }
  }
  // ...
}
```

**Key difference for guidance-package.ts:** Instead of deduplicating by client (keep latest assessment), deduplicate by `serviceRecommendationId` across ALL assessments for a single client, keeping highest urgency and merging evidence arrays.

**Batch overlay fetching pattern** from `src/lib/recommendations/solution-queries.ts` (lines 88-165):
```typescript
export async function getComposedSolutionsForAssessment(
  assessmentId: string
): Promise<Map<string, ComposedSolution>> {
  const recs = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId },
    include: { serviceRecommendation: true },
    orderBy: { priority: "asc" },
  });
  if (recs.length === 0) return new Map();

  // Resolve advisor context once
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: assessment.userId, status: "ACTIVE" },
    select: { advisor: { select: { id: true, firmName: true, enterpriseId: true, enterprise: { select: { id: true, name: true } } } } },
  });

  // Batch-fetch all overlays
  const serviceIds = recs.map((r) => r.serviceRecommendationId);
  const [enterpriseCustomizations, advisorCustomizations] = await Promise.all([
    enterprise
      ? prisma.enterpriseSolutionCustomization.findMany({
          where: { enterpriseId: enterprise.id, serviceRecommendationId: { in: serviceIds }, isActive: true },
        })
      : [],
    advisorProfile
      ? prisma.advisorSolutionCustomization.findMany({
          where: { advisorProfileId: advisorProfile.id, serviceRecommendationId: { in: serviceIds }, isActive: true },
        })
      : [],
  ]);

  // Build Maps for O(1) lookup
  const ecMap = new Map(enterpriseCustomizations.map((c) => [c.serviceRecommendationId, c]));
  const acMap = new Map(advisorCustomizations.map((c) => [c.serviceRecommendationId, c]));

  // Compose each in a loop (no N+1)
  const result = new Map<string, ComposedSolution>();
  for (const rec of recs) {
    result.set(rec.id, composeSolution({ /* ... */ }));
  }
  return result;
}
```

---

### `src/lib/recommendations/override-policy.ts` (utility, transform)

**Analog:** `src/lib/recommendations/compose-solution.ts`

**Structure pattern** (lines 1-9, 50-66):
```typescript
import "server-only";

import type {
  ServiceRecommendation,
  EnterpriseSolutionCustomization,
  AdvisorSolutionCustomization,
} from "@prisma/client";

// Types section
export type PlaybookStep = { /* ... */ };

// Helpers section
function parsePlaybookSteps(json: unknown): PlaybookStep[] {
  if (!json || typeof json !== "object") return [];
  // defensive parsing with fallbacks
}
```

**Core composition pattern -- last-writer-wins with layer attribution** (lines 90-165):
```typescript
export function composeSolution(input: ComposeInput): ComposedSolution {
  const { service, enterpriseName, advisorName } = input;

  // Gate overlay logic on isActive
  const ec = input.enterpriseCustomization?.isActive ? input.enterpriseCustomization : null;
  const ac = input.advisorCustomization?.isActive ? input.advisorCustomization : null;

  // Scalar overrides (last non-null wins)
  const estimatedCost = ac?.costOverride ?? ec?.costOverride ?? service.estimatedCost;

  // Additive playbook
  const playbook: ComposedPlaybookStep[] = [
    ...platformSteps.map((s) => ({ ...s, source: "PLATFORM" as const })),
    ...enterpriseSteps.map((s) => ({ ...s, source: "ENTERPRISE" as const })),
    ...advisorSteps.map((s) => ({ ...s, source: "ADVISOR" as const })),
  ];

  // Source layer summary
  const sourceLayer: SourceLayerSummary = {
    platform: true,
    enterprise: ec ? { id: ec.enterpriseId, name: enterpriseName ?? "Enterprise" } : null,
    advisor: ac ? { id: ac.advisorProfileId, name: advisorName ?? "Advisor" } : null,
  };

  return { /* composed result */ };
}
```

**Key extension for override-policy.ts:** Add a policy enforcement layer that wraps this pattern. PROTECTED fields always come from platform (ignore overlay values). CONFIGURABLE fields use last-writer-wins. ADDITION fields are always appended. Validate before any Prisma write to overlay tables.

---

### `src/lib/actions/guidance-actions.ts` (controller, request-response)

**Analog:** `src/lib/actions/admin-recommendation-actions.ts`

**Server action boilerplate** (lines 1-76):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminRole } from "@/lib/admin/auth";
import { logSafeError, safeErrorMessage } from "@/lib/log-safe-error";
import { writeAudit, AUDIT_ACTIONS } from "@/lib/audit/audit-log";
import { /* Zod schemas */ } from "@/lib/admin/recommendation-rule-schemas";

// Result types
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: "FK_REFS_BLOCK_DELETE" };

function fail(error: string, code?: "FK_REFS_BLOCK_DELETE"): ActionResult<never> {
  return { success: false, error, code };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

function revalidate() {
  revalidatePath("/admin/recommendations");
}
```

**CRUD action pattern with auth + Zod + audit** (lines 80-122):
```typescript
export async function createServiceRecommendation(
  input: ServiceRecommendationInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdminRole();
    const parsed = serviceRecommendationInputSchema.parse(input);

    const created = await prisma.serviceRecommendation.create({ data: { /* ... */ } });

    await writeAudit({
      actor: { userId: actor.userId, role: actor.role as UserRole, email: actor.email },
      action: AUDIT_ACTIONS.RECOMMENDATION_CREATE,
      entityType: "ServiceRecommendation",
      entityId: created.id,
      beforeData: null,
      afterData: created,
    });

    revalidate();
    return ok({ id: created.id });
  } catch (err) {
    logSafeError("createServiceRecommendation", err);
    return fail(safeErrorMessage(err, "Failed to create recommendation"));
  }
}
```

**Key adaptation for guidance-actions.ts:** Replace `requireAdminRole()` with `requireAdvisorRole()`. Add ownership verification (advisor owns the client). Use `transitionRecommendationStatus()` for state transitions instead of raw Prisma updates. Support bulk operations (array of IDs in a single transaction).

---

### `src/lib/actions/enterprise-solution-actions.ts` (controller, request-response)

**Analog:** `src/lib/actions/enterprise-recommendation-actions.ts`

**Enterprise auth pattern** (lines 1-9, 21-33):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdvisorRole, advisorHubActionErrorMessage } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";

// ...

export async function updateEnterpriseRecommendationRule(ruleId: string, data: { /* ... */ }) {
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);

    const existing = await prisma.enterpriseRecommendationRule.findFirst({
      where: { id: ruleId, enterpriseId: team.enterpriseId },
    });
    if (!existing) {
      return { success: false as const, error: "Rule not found" };
    }
    // ... mutation
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update enterprise rule"),
    };
  }
}
```

**Enterprise ownership isolation** (line 35): Always scope queries with `enterpriseId: team.enterpriseId` to prevent cross-enterprise data access.

---

### `src/lib/actions/client-action-plan-actions.ts` (controller, request-response)

**Analog:** `src/lib/actions/enterprise-recommendation-actions.ts` (for structure), but uses client auth.

**Client auth pattern** from `src/app/(protected)/dashboard/page.tsx` (lines 37-44):
```typescript
const session = await auth();
if (!session?.user?.id) {
  return null;
}
```

**Key adaptation:** Use `auth()` session directly (not `requireAdvisorRole`). Verify `assessment.userId === session.user.id` before allowing task status updates. Never expose `validationStatus` mutations to this action file -- that belongs in `guidance-actions.ts` under advisor auth.

---

### `src/app/(protected)/advisor/clients/[clientId]/guidance/page.tsx` (route)

**Analog:** `src/app/(protected)/advisor/recommendations/page.tsx`

**Server component page pattern** (lines 1-28):
```typescript
import Link from "next/link";
import { FileText, Sparkles, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortfolioRecommendationsAction } from "@/lib/actions/advisor-actions";
import { RecommendationsPortfolio } from "@/components/recommendations/RecommendationsPortfolio";
import { RecommendationsSummaryStrip } from "@/components/recommendations/RecommendationsSummaryStrip";
import { redirect } from "next/navigation";

export default async function AdvisorRecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; action?: string }>;
}) {
  const sp = await searchParams;
  // ...
  const result = await getPortfolioRecommendationsAction({ /* filters */ });
  if (!result.success) {
    redirect("/advisor");
  }
  const data = result.data!;

  return (
    <div className="space-y-8">
      {/* Hero surface */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm ring-1 ring-border/30 sm:p-5">
        {/* ... */}
      </div>
      {/* Main content */}
      <RecommendationsPortfolio groups={data.groups} />
    </div>
  );
}
```

**Hero surface pattern** (lines 31-88) -- icon + title + description + filter links + summary strip:
```typescript
<div className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm ring-1 ring-border/30 sm:p-5">
  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
    <div className="flex min-w-0 items-start gap-3 sm:items-center">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/60" aria-hidden>
        <Sparkles className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Recommendations
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Description text...
        </p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 sm:justify-end">
      {/* Action buttons */}
    </div>
  </div>
  {/* Filter links */}
  {/* Summary strip */}
</div>
```

**Key adaptation:** Route is per-client (`[clientId]` param) rather than portfolio-wide. Call guidance package query scoped to the specific client. Validate advisor ownership of the client.

---

### `src/app/(protected)/advisor/enterprise/guidance/page.tsx` (route)

**Analog:** `src/app/(protected)/advisor/enterprise/recommendations/page.tsx`

**Enterprise route with auth + data loading** (lines 1-64):
```typescript
import { redirect } from "next/navigation";
import { requireAdvisorRole } from "@/lib/advisor/auth";
import { requireEnterpriseTeamManager } from "@/lib/enterprise/team-access";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfigurationPageHeader } from "@/components/product-tour/ConfigurationPageHeader";

export default async function EnterpriseRecommendationsIndexPage() {
  let enterpriseName: string;
  let enterpriseId: string;
  try {
    const { userId } = await requireAdvisorRole();
    const team = await requireEnterpriseTeamManager(userId);
    enterpriseName = team.enterpriseName;
    enterpriseId = team.enterpriseId;
  } catch {
    redirect("/signin");
  }

  // Data loading scoped to enterprise...
  return (
    <div className="space-y-6">
      <ConfigurationPageHeader /* ... */ />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card grid */}
      </div>
    </div>
  );
}
```

---

### `src/app/(protected)/dashboard/action-plan/page.tsx` (route)

**Analog:** `src/app/(protected)/dashboard/page.tsx`

**Client dashboard auth pattern** (lines 37-74):
```typescript
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  // Role-based redirect
  const role = normalizeUserRoleString(session.user.role);
  if (role === "ADVISOR") {
    redirect("/advisor");
  }
  if (isPlatformAdminRole(role)) {
    redirect("/admin");
  }

  // Client-specific data loading...
}
```

**Key adaptation:** This page loads the client's guidance package (filtered to INCLUDED+ statuses), groups by time horizon, and renders the Strategic Action Plan layout.

---

### `src/components/guidance/RecommendationCard.tsx` (component)

**Analog:** `src/components/assessment/FacilitatedRecommendations.tsx`

**Card component pattern** (lines 44-143):
```typescript
<Card key={rec.id} className="bg-background/60">
  <CardContent className="space-y-4 pt-6">
    <div className="space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-semibold text-foreground">
          {index + 1}. {rec.serviceName}
        </h4>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">{implLabel}</Badge>
        </div>
      </div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{rec.category}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{rec.description}</p>
      <p className="text-xs italic text-muted-foreground/90">{rec.triggerSummary}</p>
    </div>

    {/* Advisor notes */}
    {rec.advisorNotes?.trim() ? (
      <p className="border-l-2 border-brand/40 pl-3 text-sm text-foreground/90">
        {rec.advisorNotes.trim()}
      </p>
    ) : null}

    {/* Detail grid */}
    <div className="grid gap-3 rounded-[1rem] border section-divider bg-background/55 p-4 text-sm sm:grid-cols-2">
      {rec.estimatedCost ? (
        <div className="flex items-start gap-2">
          <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs font-medium text-foreground">Estimated investment</p>
            <p className="text-muted-foreground">{rec.estimatedCost}</p>
          </div>
        </div>
      ) : null}
    </div>
  </CardContent>
</Card>
```

**Key extension for RecommendationCard.tsx:** Add advisor controls (Accept/Defer/Hide buttons), layer attribution badges (Platform/Enterprise/Advisor), evidence accordion, priority adjustment control.

---

### `src/components/guidance/GuidanceSummaryStrip.tsx` (component)

**Analog:** `src/components/recommendations/RecommendationsSummaryStrip.tsx`

Follow same pattern -- a horizontal stats strip with counts and badges inside the hero surface.

---

### `src/lib/asset-catalog/inheritance-engine.ts` (service, transform)

**Analog:** `src/lib/recommendations/compose-solution.ts`

Copy the generic structure: typed input, layer precedence logic, source attribution output. Abstract away from recommendation-specific types using generics.

---

### Test Files

**Analog for all test files:** `src/lib/recommendations/compose-solution.test.ts`

**Test structure pattern** (lines 1-11):
```typescript
import { describe, it, expect } from "vitest";
import { composeSolution } from "./compose-solution";
import type {
  ServiceRecommendation,
  EnterpriseSolutionCustomization,
  AdvisorSolutionCustomization,
} from "@prisma/client";
```

**Factory function pattern** (lines 9-43):
```typescript
function makeService(
  overrides: Partial<ServiceRecommendation> = {}
): ServiceRecommendation {
  return {
    id: "svc-1",
    name: "Cyber Insurance Review",
    // ... all required fields with sensible defaults
    ...overrides,
  };
}
```

**Test case pattern** (lines 83-97):
```typescript
describe("composeSolution", () => {
  it("returns platform-only solution when no overlays", () => {
    const result = composeSolution({ service: makeService() });
    expect(result.name).toBe("Cyber Insurance Review");
    expect(result.estimatedCost).toBe("$5,000");
    // ...
  });
});
```

---

## Shared Patterns

### Authentication -- Advisor Role Guard
**Source:** `src/lib/advisor/auth.ts` (lines 193-219)
**Apply to:** `guidance-actions.ts`, `enterprise-solution-actions.ts`, advisor guidance route, enterprise guidance route
```typescript
export async function requireAdvisorRole() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }
  const userRole = session.user.role?.toString().toUpperCase();
  if (!isAdvisorHubNavRole(userRole)) {
    throw new Error("Unauthorized: Advisor access required");
  }
  await assertMfaVerified(session);
  if (userRole === "ADVISOR") {
    await assertAdvisorPortalAccessForAdvisorRole(session.user.id);
  }
  return { userId: session.user.id, role: userRole, email: session.user.email ?? null };
}
```

### Authentication -- Enterprise Team Manager Guard
**Source:** `src/lib/enterprise/team-access.ts` (lines 37-43)
**Apply to:** `enterprise-solution-actions.ts`, enterprise guidance route
```typescript
export async function requireEnterpriseTeamManager(userId: string) {
  const team = await resolveEnterpriseTeamContext(userId);
  if (!team) {
    throw new Error("Unauthorized: enterprise team management requires OWNER or ADMIN role");
  }
  return team;
}
```

### Error Handling -- Server Actions
**Source:** `src/lib/actions/admin-recommendation-actions.ts` (lines 50-67)
**Apply to:** All new server action files
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

function fail(error: string, code?: string): ActionResult<never> {
  return { success: false, error, code };
}

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}
```

### Error Handling -- Enterprise Actions (alternative pattern)
**Source:** `src/lib/actions/enterprise-recommendation-actions.ts` (lines 69-74)
**Apply to:** `enterprise-solution-actions.ts`, `client-action-plan-actions.ts`
```typescript
  } catch (error) {
    return {
      success: false as const,
      error: advisorHubActionErrorMessage(error, "Failed to update enterprise rule"),
    };
  }
```

### State Machine Transitions
**Source:** `src/lib/recommendations/solution-lifecycle.ts` (lines 68-144)
**Apply to:** `guidance-actions.ts` (all status change actions)
```typescript
export async function transitionRecommendationStatus(input: {
  recommendationId: string;
  newStatus: RecommendationStatus;
  actorId: string;
  reason?: string;
  notes?: string;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const current = await tx.assessmentRecommendation.findUniqueOrThrow({
      where: { id: recommendationId },
      select: { status: true },
    });
    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(newStatus)) {
      throw new InvalidTransitionError(current.status, newStatus);
    }
    // ... update + activity log
  });
}
```

### Composition -- Three-Layer Precedence
**Source:** `src/lib/recommendations/compose-solution.ts` (lines 90-165)
**Apply to:** `inheritance-engine.ts`, `override-policy.ts`, `compose-solution.ts` (extension)
```typescript
// Gate on isActive
const ec = input.enterpriseCustomization?.isActive ? input.enterpriseCustomization : null;
const ac = input.advisorCustomization?.isActive ? input.advisorCustomization : null;

// Scalar: last non-null wins (advisor > enterprise > platform)
const estimatedCost = ac?.costOverride ?? ec?.costOverride ?? service.estimatedCost;

// Additive: concatenate from all layers
const playbook = [...platformSteps, ...enterpriseSteps, ...advisorSteps];
```

### UI -- shadcn Card List
**Source:** `src/components/recommendations/RecommendationsPortfolio.tsx` (lines 56-157)
**Apply to:** All guidance, enterprise, and action-plan components
```typescript
<div className="space-y-6">
  {groups.map((group) => (
    <Card key={group.clientId} className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{group.clientName}</CardTitle>
            <CardDescription>{/* metadata */}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {/* Action buttons */}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {/* List items */}
        </ul>
      </CardContent>
    </Card>
  ))}
</div>
```

### UI -- Empty State
**Source:** `src/components/recommendations/RecommendationsPortfolio.tsx` (lines 44-54)
**Apply to:** All list/portfolio components
```typescript
<div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center">
  <p className="text-sm font-medium text-foreground">No matched recommendations yet</p>
  <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
    Helpful explanation text...
  </p>
</div>
```

### Validation -- Zod Schemas
**Source:** `src/lib/admin/recommendation-rule-schemas.ts` (referenced by admin actions)
**Apply to:** All new server action files -- define Zod schemas in a separate file, import into actions.

### Testing -- Factory + Vitest
**Source:** `src/lib/recommendations/compose-solution.test.ts` (lines 1-82)
**Apply to:** All 6 new test files
```typescript
import { describe, it, expect } from "vitest";

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return { /* sensible defaults */ ...overrides };
}

describe("functionName", () => {
  it("describes expected behavior", () => {
    const result = functionUnderTest(makeEntity());
    expect(result.field).toBe(expectedValue);
  });
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/components/guidance/DeferDialog.tsx` | component | request-response | No existing dialog-with-form pattern for recommendation workflows; use shadcn Dialog + React Hook Form |
| `src/components/guidance/BulkActionBar.tsx` | component | request-response | No existing sticky bulk action bar pattern; build with fixed positioning + shadcn Button group |
| `src/components/enterprise/OverlayFieldEditor.tsx` | component | request-response | No existing two-column overlay editor; build from Card layout pattern |
| `src/components/enterprise/ComposedPreviewSheet.tsx` | component | request-response | No existing Sheet-based preview; use shadcn Sheet (to be installed) |

## Metadata

**Analog search scope:** `src/lib/recommendations/`, `src/lib/actions/`, `src/app/(protected)/advisor/`, `src/app/(protected)/dashboard/`, `src/components/recommendations/`, `src/components/assessment/`, `src/lib/advisor/`, `src/lib/enterprise/`, `src/lib/client/`
**Files scanned:** ~30
**Pattern extraction date:** 2026-06-26
