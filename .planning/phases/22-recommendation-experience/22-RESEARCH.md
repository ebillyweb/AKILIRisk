# Phase 22: Recommendation Experience - Research

**Researched:** 2026-06-26
**Domain:** Multi-role recommendation lifecycle UI (advisor curation, enterprise overlays, client action plan)
**Confidence:** HIGH

## Summary

Phase 22 builds three role-specific UIs on top of the existing Risk Solutions Library infrastructure (schema, composition engine, lifecycle state machine) completed in Phase 21. The core backend primitives -- `composeSolution()`, `transitionRecommendationStatus()`, `hydrateMilestones()`, and the four-model schema (ServiceRecommendation, AssessmentRecommendation, EnterpriseSolutionCustomization, AdvisorSolutionCustomization) -- are already in place and working. The primary work is: (1) schema evolution to support the new lifecycle states, override policy tiers, defer semantics, dual-track status, and per-client guidance package aggregation; (2) new server actions and query functions for each role; (3) three new page-level UI surfaces.

The critical architectural decision is the "per-client guidance package" model (D-01, D-02). Current queries are per-assessment (`getComposedSolutionsForAssessment`). Phase 22 must introduce a per-client aggregation layer that synthesizes recommendations across ALL completed assessments, handling deduplication when the same ServiceRecommendation fires on multiple assessments. The existing `@@unique([assessmentId, serviceRecommendationId])` constraint means a given service can appear once per assessment but multiple times across assessments for the same client.

**Primary recommendation:** Extend the existing schema and composition engine incrementally -- do not rebuild. Add new enum values to `RecommendationStatus`, new columns to `AssessmentRecommendation`, and a new `GuidancePackageView` query layer that aggregates across assessments per client. Build the three UIs as standard Next.js App Router pages using established patterns (server components with `requireAdvisorRole()` guards, shadcn/ui components, TanStack for data tables where needed).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dedicated per-client Guidance Review page (not per-assessment or per-pillar)
- **D-02:** Guidance package is a living, cumulative artifact across all assessments
- **D-03:** Guidance Review sections: Executive Summary, Profile Insights, Attention Items, Recommended Actions, Evidence, Implementation Plan
- **D-04:** Each recommendation shows: Insight, Evidence, Why It Matters, Recommended Action, Layer Attribution, Advisor Controls
- **D-05:** Advisor controls: Accept, Defer, Mark Already Addressed, Hide from Client, Add Advisor Notes, Adjust Priority
- **D-06:** AKILI sets initial priority via urgency score; advisor overrides with high/medium/low
- **D-07:** Lifecycle: Generated -> Reviewed -> Included in Action Plan -> In Progress -> Completed
- **D-08:** Defer = "not now" with required reason, optional revisit date, optional trigger event
- **D-09:** Generic asset-agnostic inheritance/composition engine; recommendations first consumer
- **D-10:** Four-layer inheritance: Platform -> Enterprise Overlay -> Advisor Customization -> Client Output
- **D-11:** Three-tier override policy: Always Protected / Configurable / Enterprise Additions
- **D-12:** Advisor layer can hide enterprise guidance, add notes, change timing; never alter platform insight
- **D-13:** Enterprise inline inheritance model -- browse catalog, create overlays not copies
- **D-14:** Enterprise overlay fields: enable/disable, required/optional, priority adjustments, custom guidance, playbooks, vendors, compliance, costs, timelines, branding, links
- **D-15:** UI always distinguishes Platform Definition from Enterprise Overlay
- **D-16:** Rename to "Strategic Action Plan"
- **D-17:** SAP answers: Where are we today? What first? Why? How to measure progress?
- **D-18:** SAP sections: Executive Summary, Immediate Priorities (0-90d), Strategic Initiatives (3-12mo), Ongoing Practices, Progress Dashboard
- **D-19:** Each action preserves full reasoning chain
- **D-20:** Separate Role from Assignee on every action
- **D-21:** Dual status tracks: Task Status (client) + Validation Status (advisor)
- **D-22:** Validation requirement configurable by platform/enterprise per action type
- **D-23:** Full layer transparency for advisors; simplified composed view for clients

### Claude's Discretion
- Generic asset catalog schema design (table structure, polymorphic vs per-type, JSON vs relational for overlay fields)
- Composition engine implementation approach (query-time composition vs materialized views)
- API design for guidance package endpoints
- Cross-assessment recommendation deduplication algorithm
- UI component architecture and routing structure
- Migration strategy for existing AssessmentRecommendation data to new lifecycle states

### Deferred Ideas (OUT OF SCOPE)
- Generic Platform Asset Catalog UI for non-recommendation asset types
- Workflow automation based on Responsible Role assignments
- Client-to-client collaboration on shared action items
- Integration with external project management tools
- AI-powered recommendation merging and deduplication (rule-based only in Phase 22)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFECYCLE-01 | Recommendation experience: advisor review/curation, enterprise overlays, client action plan with full lifecycle from generated through completed | Schema evolution (new enum values, new columns), three role-specific UI surfaces, composition engine extension, per-client aggregation queries |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Guidance package aggregation (cross-assessment) | API / Backend | Database | Query-time composition across assessments, owned by server-side query layer |
| Recommendation lifecycle state machine | API / Backend | -- | Business logic: transitions, validation, activity logging all server-side |
| Three-layer composition engine | API / Backend | -- | `composeSolution()` already server-only, extends naturally |
| Override policy enforcement | API / Backend | -- | Protected/Configurable/Additions tiers enforced at mutation time |
| Advisor Guidance Review UI | Frontend Server (SSR) | Browser / Client | Server component page with client-side interactive controls (bulk select, dialogs) |
| Enterprise overlay editor | Frontend Server (SSR) | Browser / Client | Two-column layout, form state managed client-side, saves via server actions |
| Client Strategic Action Plan | Frontend Server (SSR) | Browser / Client | Server-rendered page with client-side status selectors |
| Deduplication across assessments | API / Backend | -- | Rule-based merging at query time when building per-client view |
| Dual status tracking (task + validation) | Database | API / Backend | New columns on AssessmentRecommendation, mutations via server actions |
| Role/Assignee management | API / Backend | Browser / Client | Server actions for CRUD, client-side forms for assignment |

## Standard Stack

### Core (already installed -- no new packages)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16+ | App Router, server components, server actions | Project foundation [VERIFIED: package.json] |
| Prisma | 7 | ORM, migrations, schema evolution | Project database layer [VERIFIED: schema.prisma] |
| shadcn/ui | latest | UI component library (Radix-based) | Project UI standard [VERIFIED: components.json] |
| TanStack React Table | installed | Data-heavy advisor views | Already used for portfolio views [VERIFIED: codebase] |
| Recharts | installed | Analytics visualizations | Already used for dashboards [VERIFIED: codebase] |
| Zod | installed | Server action input validation | Already used across all actions [VERIFIED: codebase] |
| lucide-react | installed | Icons | Project icon standard [VERIFIED: codebase] |
| date-fns | installed | Date formatting | Already used in recommendation views [VERIFIED: codebase] |

### Additional shadcn Components to Install
| Component | Purpose | Source |
|-----------|---------|--------|
| accordion | Collapsible evidence panels in recommendation cards | shadcn official registry [CITED: 22-UI-SPEC.md] |
| sheet | Advisor notes side panel, enterprise overlay preview | shadcn official registry [CITED: 22-UI-SPEC.md] |

**Installation:**
```bash
npx shadcn@latest add accordion sheet
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Query-time composition | Materialized views / denormalized table | Materialized adds write complexity and staleness risk; query-time is simpler given expected data volumes (tens of recommendations per client, not thousands) |
| Separate GuidancePackage table | Virtual aggregation via query layer | A physical table would need sync triggers on every assessment change; virtual aggregation is simpler and always current |

## Package Legitimacy Audit

No new external packages required. The two shadcn components (accordion, sheet) are from the official shadcn registry and install as local source files, not npm dependencies.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Assessment Completion
        |
        v
RecommendationEngine.generateRecommendations()
        |
        v
AssessmentRecommendation rows (per-assessment, status: GENERATED)
        |
        +---> Per-Client Aggregation Query Layer (NEW)
        |         |
        |         v
        |     GuidancePackage (virtual, query-time)
        |         |
        |         +---> Dedup: same ServiceRecommendation across assessments
        |         |     -> keep highest-urgency instance, merge evidence
        |         |
        |         +---> composeSolution() per recommendation
        |                   |
        |                   +---> Platform ServiceRecommendation
        |                   +---> EnterpriseSolutionCustomization
        |                   +---> AdvisorSolutionCustomization
        |                   |
        |                   v
        |              ComposedSolution (with override policy enforcement)
        |
        +---> Advisor Guidance Review Page
        |         |
        |         +---> Accept/Defer/Hide/Adjust actions (server actions)
        |         +---> Bulk actions
        |         +---> Advisory notes (inline save)
        |
        +---> Enterprise Overlay Editor Page
        |         |
        |         +---> Two-column: Platform Definition | Enterprise Overlay
        |         +---> Save overlay (server action)
        |         +---> Preview composed result (Sheet)
        |
        +---> Client Strategic Action Plan Page
                  |
                  +---> Included recommendations only (status: INCLUDED+)
                  +---> Grouped by time horizon (0-90d / 3-12mo / ongoing)
                  +---> Task Status selector (client-managed)
                  +---> Validation Status badge (advisor-managed, read-only)
```

### Recommended Project Structure
```
src/
├── lib/
│   ├── recommendations/
│   │   ├── compose-solution.ts          # EXTEND: add override policy enforcement
│   │   ├── solution-lifecycle.ts        # EXTEND: new states, defer logic
│   │   ├── solution-queries.ts          # EXTEND: per-client aggregation
│   │   ├── guidance-package.ts          # NEW: cross-assessment aggregation + dedup
│   │   ├── override-policy.ts           # NEW: protected/configurable/additions enforcement
│   │   └── types.ts                     # EXTEND: new types for guidance package
│   ├── actions/
│   │   ├── guidance-actions.ts          # NEW: advisor guidance review actions
│   │   ├── enterprise-solution-actions.ts # NEW: enterprise overlay CRUD
│   │   └── client-action-plan-actions.ts  # NEW: client task status updates
│   └── asset-catalog/
│       ├── inheritance-engine.ts        # NEW: generic inheritance/composition (D-09)
│       └── types.ts                     # NEW: asset-agnostic types
├── components/
│   ├── guidance/
│   │   ├── GuidanceReviewPage.tsx       # Advisor: main guidance review
│   │   ├── ProfileInsightsSection.tsx   # Cross-assessment synthesized insights
│   │   ├── AttentionItemsSection.tsx    # Family/ownership/governance/succession
│   │   ├── RecommendationCard.tsx       # Single recommendation with controls
│   │   ├── EvidenceAccordion.tsx         # Collapsible evidence panel
│   │   ├── DeferDialog.tsx              # Defer reason/date/trigger dialog
│   │   ├── BulkActionBar.tsx            # Sticky bottom bulk actions
│   │   └── GuidanceSummaryStrip.tsx     # Executive summary hero strip
│   ├── enterprise/
│   │   ├── GuidanceCustomization.tsx    # Two-column overlay editor
│   │   ├── OverlayFieldEditor.tsx       # Per-field overlay editor
│   │   └── ComposedPreviewSheet.tsx     # Preview sheet
│   └── action-plan/
│       ├── StrategicActionPlan.tsx       # Client: main action plan page
│       ├── ActionCard.tsx               # Single action with status selector
│       ├── ExecutiveSummary.tsx          # Hero summary card
│       ├── ProgressDashboard.tsx         # Progress bars + completion %
│       └── TimeHorizonSection.tsx        # Grouped section (0-90d, 3-12mo, ongoing)
└── app/(protected)/
    ├── advisor/
    │   ├── clients/[clientId]/guidance/
    │   │   └── page.tsx                 # Advisor guidance review route
    │   └── enterprise/guidance/
    │       └── page.tsx                 # Enterprise overlay editor route
    └── dashboard/
        └── action-plan/
            └── page.tsx                 # Client strategic action plan route
```

### Pattern 1: Per-Client Guidance Package Aggregation
**What:** Query all AssessmentRecommendation rows across all completed assessments for a client, deduplicate by ServiceRecommendation, and compose each into a unified guidance package.
**When to use:** Advisor guidance review page, client strategic action plan page.
**Example:**
```typescript
// Source: derived from existing solution-queries.ts pattern
async function getGuidancePackageForClient(clientId: string): Promise<GuidancePackage> {
  // 1. Find all completed assessments for this client
  const assessments = await prisma.assessment.findMany({
    where: { userId: clientId, status: "COMPLETED" },
    select: { id: true, completedAt: true },
    orderBy: { completedAt: "desc" },
  });

  // 2. Get all recommendations across assessments
  const recs = await prisma.assessmentRecommendation.findMany({
    where: { assessmentId: { in: assessments.map(a => a.id) } },
    include: { serviceRecommendation: true, milestones: true },
    orderBy: { urgencyScore: "desc" },
  });

  // 3. Deduplicate by serviceRecommendationId (keep highest urgency)
  const deduped = deduplicateRecommendations(recs);

  // 4. Compose each with overlays
  // ... resolve advisor/enterprise context, batch-fetch overlays
  // ... apply override policy
  return buildGuidancePackage(deduped, overlays);
}
```

### Pattern 2: Lifecycle State Machine Extension
**What:** Extend existing `ALLOWED_TRANSITIONS` to support new states (INCLUDED, DEFERRED) and the implementation-focused flow.
**When to use:** All status transitions.
**Example:**
```typescript
// Source: extending existing solution-lifecycle.ts
// Current enum: PENDING, REVIEWED, ACCEPTED, DECLINED, COMPLETED
// New enum values needed: INCLUDED, DEFERRED, IN_PROGRESS
// Migration: ACCEPTED -> INCLUDED (semantic rename via DB migration)

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  GENERATED: ["REVIEWED", "DEFERRED"],
  REVIEWED: ["INCLUDED", "DEFERRED"],
  INCLUDED: ["IN_PROGRESS", "DEFERRED"],
  IN_PROGRESS: ["COMPLETED"],
  DEFERRED: ["REVIEWED"],  // Can be re-reviewed later
  COMPLETED: [],
};
```

### Pattern 3: Override Policy Enforcement
**What:** Validate that mutations to composed solutions respect the three-tier override policy (D-11).
**When to use:** Enterprise overlay save, advisor customization save.
**Example:**
```typescript
// Source: derived from D-11 decisions
type OverridePolicy = "PROTECTED" | "CONFIGURABLE" | "ADDITION";

const FIELD_POLICIES: Record<string, OverridePolicy> = {
  // Protected: never suppressed
  insight: "PROTECTED",
  whyItMatters: "PROTECTED",
  evidence: "PROTECTED",
  riskRationale: "PROTECTED",
  confidence: "PROTECTED",
  // Configurable: can be added/hidden/replaced
  implementationGuidance: "CONFIGURABLE",
  preferredVendors: "CONFIGURABLE",
  estimatedCost: "CONFIGURABLE",
  estimatedTimeline: "CONFIGURABLE",
  // Additions: always appendable
  firmGuidance: "ADDITION",
  internalProcedures: "ADDITION",
  complianceRequirements: "ADDITION",
};
```

### Pattern 4: Generic Asset Catalog Inheritance Engine (D-09)
**What:** An asset-agnostic composition engine that defines the Platform -> Enterprise -> Advisor -> Client layering pattern.
**When to use:** Recommendations are the first consumer. Future asset types adopt the same interface.
**Example:**
```typescript
// Source: derived from D-09, D-10 decisions
interface AssetLayer<T> {
  platform: T;
  enterprise?: Partial<T> | null;
  advisor?: Partial<T> | null;
}

interface AssetOverridePolicy {
  field: string;
  tier: "PROTECTED" | "CONFIGURABLE" | "ADDITION";
}

function composeAsset<T extends Record<string, unknown>>(
  layers: AssetLayer<T>,
  policies: AssetOverridePolicy[],
): T & { sourceAttribution: Record<string, string> } {
  // Apply policies: protected fields always from platform,
  // configurable fields use last-writer-wins,
  // addition fields are appended
}
```

### Anti-Patterns to Avoid
- **Copying platform data into enterprise overlays:** Enterprise overlays are sparse -- only store overrides, never copy platform values. The composition engine reads from platform at query time. [CITED: D-13, D-15]
- **Per-assessment action plan:** The client sees ONE Strategic Action Plan across all assessments, not one per assessment. Never scope client-facing queries to a single assessmentId. [CITED: D-01, D-02]
- **Conflating task status and validation status:** These are separate tracks managed by different roles. Never let a client change validation status or an advisor change task status through the same action. [CITED: D-21]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dialog/Sheet overlays | Custom modal system | shadcn Dialog/Sheet (already installed + accordion/sheet to add) | Focus trap, keyboard nav, aria-modal handled automatically |
| Optimistic UI updates | Custom state reconciliation | React `useOptimistic` + `useTransition` with server actions | Next.js 15+ pattern, handles revalidation automatically |
| Form state management | Custom form state | React Hook Form + Zod (already in project) | Project-wide pattern for validated forms |
| Data table with sorting/filtering | Custom table | TanStack React Table (already installed) | Already used for advisor portfolio views |
| Date formatting | Custom formatters | date-fns (already installed) | Already used in recommendation views |
| Progress visualization | Custom SVG | Recharts (already installed) + shadcn Progress | Project-standard visualization stack |

**Key insight:** All UI primitives needed for this phase are already in the project. The work is wiring existing components to new data flows, not building new infrastructure.

## Common Pitfalls

### Pitfall 1: N+1 Queries in Guidance Package Assembly
**What goes wrong:** Loading recommendations, then fetching composition data (enterprise/advisor overlays) per recommendation individually.
**Why it happens:** The existing `getComposedSolutionForRecommendation()` is designed for single-item use. Guidance package loads 10-30 items.
**How to avoid:** Follow the batch pattern in `getComposedSolutionsForAssessment()` -- collect all serviceRecommendationIds, batch-fetch overlays with `findMany` + `{ in: serviceIds }`, build a Map, compose in a loop. [VERIFIED: existing pattern in solution-queries.ts]
**Warning signs:** Slow guidance page loads (>2s target from project patterns).

### Pitfall 2: Enum Migration Breaking Existing Data
**What goes wrong:** Adding new enum values (GENERATED, INCLUDED, DEFERRED, IN_PROGRESS) to `RecommendationStatus` without migrating existing rows.
**Why it happens:** Existing rows have PENDING/REVIEWED/ACCEPTED/DECLINED/COMPLETED. New lifecycle maps differently.
**How to avoid:** Two-step migration: (1) Add new enum values alongside existing ones. (2) Run data migration to map PENDING->GENERATED, ACCEPTED->INCLUDED. Keep old values in the enum temporarily for backward compat, remove in a later cleanup.
**Warning signs:** Prisma errors on rows with unmapped enum values.

### Pitfall 3: Cross-Assessment Dedup Losing Evidence
**What goes wrong:** When the same ServiceRecommendation fires on two assessments (e.g., governance and cyber both recommend "Estate Planning Review"), naive dedup drops evidence from the lower-priority instance.
**Why it happens:** Taking only the highest-urgency row discards context from other assessments.
**How to avoid:** Merge evidence arrays when deduplicating. Keep the highest urgency score but union the trigger reasons and assessment references. Store merged evidence as a JSON array referencing source assessments.
**Warning signs:** Client sees a recommendation with evidence from only one assessment when they completed multiple.

### Pitfall 4: Race Condition on Bulk Actions
**What goes wrong:** Bulk "Include All Selected" fires N parallel server action calls that all try to transition status. If one recommendation was already transitioned by another session, the state machine rejects it.
**Why it happens:** Multiple advisor sessions or concurrent bulk operations.
**How to avoid:** Use a single server action that accepts an array of IDs and processes them in a single transaction. Return per-item success/failure results.
**Warning signs:** Partial bulk action failures with cryptic "Cannot transition from X to Y" errors.

### Pitfall 5: Override Policy Bypass via Direct DB Access
**What goes wrong:** Enterprise or advisor mutations bypass the override policy check and write to protected fields.
**Why it happens:** Server actions directly update Prisma models without policy validation.
**How to avoid:** All mutations to overlay tables must go through a policy-enforcing middleware layer. Validate field-level permissions before writing. Return clear error messages for policy violations.
**Warning signs:** Platform insight text being overwritten by enterprise overlay.

## Code Examples

### Server Action Pattern: Advisor Guidance Actions
```typescript
// Source: derived from existing advisor-actions pattern [VERIFIED: codebase]
"use server";

import { z } from "zod";
import { requireAdvisorRole } from "@/lib/advisor/auth";

const includeInActionPlanSchema = z.object({
  recommendationIds: z.array(z.string().cuid()).min(1).max(100),
});

export async function includeInActionPlan(input: z.infer<typeof includeInActionPlanSchema>) {
  const { userId } = await requireAdvisorRole();
  const parsed = includeInActionPlanSchema.parse(input);

  // Verify advisor owns these clients
  // Transition each in a single transaction
  // Return per-item results
}
```

### Dedup Algorithm Sketch
```typescript
// Source: derived from D-02 cross-assessment dedup requirement [ASSUMED]
type MergedRecommendation = {
  primaryId: string;                    // AssessmentRecommendation id with highest urgency
  serviceRecommendationId: string;
  urgencyScore: number;                 // Max across instances
  assessmentSources: string[];          // All assessment IDs that triggered this
  mergedEvidence: TriggerReason[];      // Union of all trigger reasons
  status: RecommendationStatus;         // Status from primary instance
};

function deduplicateRecommendations(
  recs: AssessmentRecommendationWithService[]
): MergedRecommendation[] {
  const byService = new Map<string, typeof recs>();
  for (const rec of recs) {
    const existing = byService.get(rec.serviceRecommendationId) ?? [];
    existing.push(rec);
    byService.set(rec.serviceRecommendationId, existing);
  }

  return [...byService.values()].map((group) => {
    // Sort by urgency descending, pick primary
    group.sort((a, b) => (b.urgencyScore ?? 0) - (a.urgencyScore ?? 0));
    const primary = group[0];
    return {
      primaryId: primary.id,
      serviceRecommendationId: primary.serviceRecommendationId,
      urgencyScore: primary.urgencyScore ?? 0,
      assessmentSources: group.map(r => r.assessmentId),
      mergedEvidence: group.flatMap(r =>
        Array.isArray(r.triggerReason) ? r.triggerReason : [r.triggerReason]
      ),
      status: primary.status,
    };
  });
}
```

### Client Task Status Update Pattern
```typescript
// Source: derived from D-21 dual status tracks [ASSUMED]
const updateTaskStatusSchema = z.object({
  recommendationId: z.string().cuid(),
  taskStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "WAITING", "READY_FOR_REVIEW", "COMPLETED"]),
});

export async function updateTaskStatus(input: z.infer<typeof updateTaskStatusSchema>) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Verify the recommendation belongs to this client
  // Update taskStatus column (client-managed)
  // If COMPLETED and action requires validation, create validation request
  // Log activity
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-assessment recommendation view | Per-client cumulative guidance package | Phase 22 (this phase) | Recommendations span all assessments, not scoped to one |
| PENDING/REVIEWED/ACCEPTED/DECLINED/COMPLETED | GENERATED/REVIEWED/INCLUDED/IN_PROGRESS/COMPLETED/DEFERRED | Phase 22 (this phase) | Implementation-focused lifecycle replaces approval-centric model |
| Single status track | Dual tracks: Task Status (client) + Validation Status (advisor) | Phase 22 (this phase) | Shared ownership between client and advisor |
| Flat recommendation list | Strategic Action Plan with time horizons | Phase 22 (this phase) | Client sees structured roadmap, not a flat list |

**Deprecated/outdated:**
- "Family Roadmap" naming: Replaced by "Strategic Action Plan" (D-16)
- Per-assessment recommendation scoping: Replaced by per-client guidance package (D-01, D-02)
- `ACCEPTED` status: Semantically replaced by `INCLUDED` ("Included in Action Plan")

## Schema Evolution Summary

### New Enum Values Needed

**RecommendationStatus (extend existing):**
- Add: `GENERATED`, `INCLUDED`, `DEFERRED`, `IN_PROGRESS`
- Migration mapping: `PENDING` -> `GENERATED`, `ACCEPTED` -> `INCLUDED`
- Keep `REVIEWED`, `COMPLETED` as-is
- `DECLINED` -> evaluate: may map to hidden/deferred depending on existing usage

**New Enum: TaskStatus**
```
NOT_STARTED | IN_PROGRESS | WAITING | READY_FOR_REVIEW | COMPLETED
```

**New Enum: ValidationStatus**
```
PENDING_REVIEW | VERIFIED | NEEDS_FOLLOWUP
```

**New Enum: AdvisorPriority**
```
HIGH | MEDIUM | LOW
```

### New Columns on AssessmentRecommendation
- `taskStatus` (TaskStatus, default NOT_STARTED) -- client-managed
- `validationStatus` (ValidationStatus, default PENDING_REVIEW) -- advisor-managed
- `requiresValidation` (Boolean, default false) -- platform/enterprise configurable
- `advisorPriority` (AdvisorPriority, nullable) -- advisor override of urgencyScore
- `hiddenFromClient` (Boolean, default false) -- D-05 "Hide from Client"
- `deferredReason` (String, nullable) -- D-08
- `deferredRevisitDate` (DateTime, nullable) -- D-08
- `deferredTriggerEvent` (String, nullable) -- D-08
- `responsibleRoles` (String[], default []) -- D-20 platform-defined role list
- `assignees` (Json, nullable) -- D-20 freeform assignee list

### New Columns on EnterpriseSolutionCustomization (extend existing)
- `isRequired` (Boolean, default false) -- D-14
- `priorityAdjustment` (Int, nullable) -- D-14
- `complianceDisclosures` (String, nullable) -- D-14
- `customGuidance` (String, nullable) -- D-14
- `internalLinks` (Json, nullable) -- D-14

### Generic Asset Catalog Foundation (D-09)
- `AssetType` enum: `RECOMMENDATION` (first), extensible for future types
- `OverridePolicy` table or JSON structure on ServiceRecommendation defining per-field policies
- Can be stored as a JSON column `overridePolicies` on ServiceRecommendation initially, graduating to a separate table if other asset types need it

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Deduplication should use highest-urgency-wins with merged evidence | Architecture Patterns | Could lose important context from lower-urgency instances; user may prefer different merge strategy |
| A2 | Query-time composition is sufficient (no materialized views needed) | Standard Stack | If clients have 100+ recommendations across many assessments, query time could exceed 2s target |
| A3 | `overridePolicies` stored as JSON on ServiceRecommendation is adequate for D-09 | Schema Evolution | If future asset types need different policy shapes, may need migration to separate table |
| A4 | DECLINED status should be removed/mapped rather than kept alongside DEFERRED | Schema Evolution | If existing workflows rely on DECLINED semantics distinct from DEFERRED |
| A5 | Cross-assessment dedup algorithm sketch (group by serviceRecommendationId, keep highest urgency) | Code Examples | Rule-based dedup may miss semantic duplicates where different ServiceRecommendations address the same underlying issue |
| A6 | Client Strategic Action Plan route at `/dashboard/action-plan` | Project Structure | Might need different path based on existing client routing conventions |

## Open Questions (RESOLVED)

1. **Existing DECLINED data migration** (RESOLVED)
   - What we know: Current enum has DECLINED with `declinedAt` and `declinedReason` columns. Phase 22 introduces DEFERRED (similar but with revisit semantics).
   - Resolution: Plan 01 keeps DECLINED in the enum for backward compatibility alongside DEFERRED. Existing DECLINED rows remain terminal (no re-review). New lifecycle uses DEFERRED for "not now" semantics with revisit. No data migration needed -- old values coexist with new ones.

2. **Guidance package data freshness on reassessment** (RESOLVED)
   - What we know: D-02 says guidance package is cumulative. New assessments enrich the existing package.
   - Resolution: Phase 22 handles initial aggregation only. Phase 24 (Continuous Risk Improvement) handles reassessment-driven re-evaluation per research recommendation. Scope kept clean.

3. **Enterprise overlay editor: one recommendation at a time or batch?** (RESOLVED)
   - What we know: D-13/D-14 describe per-recommendation overlay fields. D-15 shows side-by-side UI.
   - Resolution: Plan 05 implements list+detail pattern -- left panel for browsing catalog, right panel for editing one recommendation's overlay at a time. Matches "browse catalog and create overlays" language in D-13.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed, configured globally) |
| Config file | vitest.config.ts |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFECYCLE-01a | Lifecycle state machine transitions (new states) | unit | `npx vitest run src/lib/recommendations/solution-lifecycle.test.ts -t "transition"` | Extend existing |
| LIFECYCLE-01b | Cross-assessment deduplication | unit | `npx vitest run src/lib/recommendations/guidance-package.test.ts` | Wave 0 |
| LIFECYCLE-01c | Override policy enforcement | unit | `npx vitest run src/lib/recommendations/override-policy.test.ts` | Wave 0 |
| LIFECYCLE-01d | Advisor guidance actions (include, defer, hide) | unit | `npx vitest run src/lib/actions/guidance-actions.test.ts` | Wave 0 |
| LIFECYCLE-01e | Enterprise overlay CRUD with policy checks | unit | `npx vitest run src/lib/actions/enterprise-solution-actions.test.ts` | Wave 0 |
| LIFECYCLE-01f | Client task status update | unit | `npx vitest run src/lib/actions/client-action-plan-actions.test.ts` | Wave 0 |
| LIFECYCLE-01g | Generic asset composition engine | unit | `npx vitest run src/lib/asset-catalog/inheritance-engine.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --run --reporter=verbose`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/recommendations/guidance-package.test.ts` -- covers LIFECYCLE-01b
- [ ] `src/lib/recommendations/override-policy.test.ts` -- covers LIFECYCLE-01c
- [ ] `src/lib/actions/guidance-actions.test.ts` -- covers LIFECYCLE-01d
- [ ] `src/lib/actions/enterprise-solution-actions.test.ts` -- covers LIFECYCLE-01e
- [ ] `src/lib/actions/client-action-plan-actions.test.ts` -- covers LIFECYCLE-01f
- [ ] `src/lib/asset-catalog/inheritance-engine.test.ts` -- covers LIFECYCLE-01g

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Existing auth layer (NextAuth) |
| V3 Session Management | no | Existing session management |
| V4 Access Control | yes | `requireAdvisorRole()`, `requireEnterpriseTeamManager()`, ownership-enforced queries |
| V5 Input Validation | yes | Zod schemas on all server actions |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Advisor accessing another advisor's client guidance | Information Disclosure | Ownership check: verify clientId belongs to advisor's assignments before returning data |
| Enterprise admin modifying another enterprise's overlays | Tampering | `requireEnterpriseTeamManager()` gate on all enterprise overlay mutations |
| Client updating another client's task status | Elevation of Privilege | Session userId must match recommendation's assessment userId |
| Bulk action parameter tampering (include IDs not belonging to advisor) | Tampering | Validate every ID in bulk array against advisor's client list within transaction |
| Override policy bypass via crafted payload | Tampering | Server-side policy enforcement before Prisma write; never trust client field selections |

## Sources

### Primary (HIGH confidence)
- Prisma schema (`prisma/schema.prisma`) -- verified all existing models, enums, relationships
- Existing composition engine (`src/lib/recommendations/compose-solution.ts`) -- verified three-layer precedence logic
- Existing lifecycle state machine (`src/lib/recommendations/solution-lifecycle.ts`) -- verified transition map, milestone hydration
- Existing query patterns (`src/lib/recommendations/solution-queries.ts`, `queries.ts`) -- verified batch overlay fetching
- UI-SPEC (`22-UI-SPEC.md`) -- verified component inventory, layout patterns, copywriting
- CONTEXT.md (`22-CONTEXT.md`) -- all 23 locked decisions

### Secondary (MEDIUM confidence)
- AdvisorPageHeader pattern (`src/components/advisor/AdvisorPageHeader.tsx`) -- verified existing UI pattern for consistency

### Tertiary (LOW confidence)
- Dedup algorithm specifics (A1, A5) -- derived from requirements, not validated against real data volumes

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in codebase
- Architecture: HIGH -- extends existing proven patterns with clear schema evolution path
- Pitfalls: HIGH -- identified from actual code analysis of existing composition/query patterns
- Schema evolution: MEDIUM -- enum migration strategy needs production data validation (Open Question 1, now resolved)
- Dedup algorithm: LOW -- rule-based approach sketched but not validated against real multi-assessment data

**Research date:** 2026-06-26
**Valid until:** 2026-07-26 (stable -- extends existing infrastructure, no external API dependencies)
