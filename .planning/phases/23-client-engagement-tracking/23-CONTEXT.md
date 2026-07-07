# Phase 23: Optional Client Engagement & Implementation Tracking - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an opt-in project-management layer for ongoing client engagement. Enterprise admins control availability via feature flag. Tracking auto-activates when an advisor publishes a Strategic Action Plan. Advisors who never publish experience zero UI noise. Extends the existing Action Plan page with milestone progress, activity feed, and engagement metrics -- no new client-facing pages.

</domain>

<decisions>
## Implementation Decisions

### Opt-in Mechanics

- **D-01:** Enterprise-level feature flag controls whether implementation tracking exists for the firm. Disabled = zero UI change from today's behavior.
- **D-02:** Tracking auto-activates when the advisor publishes a Strategic Action Plan to the client. No separate "enable tracking" toggle or button.
- **D-03:** Advisor controls publication. If they never publish an Action Plan, the client never sees tracking features. The advisor's choice to publish is the activation gate.

### Activity Feed

- **D-04:** Chronological timeline, single stream per client (not per-recommendation). Reverse-chronological, collapsible by date grouping.
- **D-05:** Role-filtered: advisors see all events, clients see their own actions plus advisor-visible notes.
- **D-06:** Feed is an inline collapsible section ("Recent Activity") on the Strategic Action Plan page. Zero-state: section does not render until first activity exists. No empty states, no placeholder text.

### Engagement Dashboard

- **D-07:** Advisor portfolio gets an engagement column in the existing client table showing actions count and completion percentage. Clients without a published action plan show "--" (zero noise).
- **D-08:** Separate engagement dashboard page for deep analytics: completion rates, stalled clients, upcoming milestones, overdue items.
- **D-09:** Client sees enhanced Action Plan with per-recommendation progress bars (milestone completion percentage) and a "Next Step" callout highlighting the most urgent incomplete milestone with due date. Enhances existing ProgressDashboard component.

### Milestone Controls

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 22 Context (predecessor decisions)
- `.planning/phases/22-recommendation-experience/22-CONTEXT.md` -- Inheritance engine, lifecycle states, Strategic Action Plan design, dual-track ownership model

### Solution Lifecycle & Composition
- `src/lib/recommendations/solution-lifecycle.ts` -- State machine, transitionRecommendationStatus(), hydrateMilestones(), SolutionActivity logging
- `src/lib/recommendations/compose-solution.ts` -- Three-layer composition (platform -> enterprise -> advisor)
- `src/lib/recommendations/solution-queries.ts` -- Composed solution queries
- `src/lib/recommendations/types.ts` -- ComposedSolution, SourceLayerSummary types

### Client Action Plan (existing)
- `src/lib/actions/client-action-plan-actions.ts` -- getClientActionPlan(), updateTaskStatus(), validation request creation
- `src/components/action-plan/ProgressDashboard.tsx` -- Completion % and per-recommendation progress (extend for milestone-level progress)
- `src/components/action-plan/ExecutiveSummary.tsx` -- Readiness score, top priorities
- `src/components/action-plan/ActionCard.tsx` -- Task status dropdown, playbook steps, validation badge
- `src/components/action-plan/StrategicActionPlan.tsx` -- Composes all Action Plan sections
- `src/app/(protected)/dashboard/action-plan/page.tsx` -- Client action plan page

### Advisor Portfolio & Pipeline
- `src/components/pipeline/WorkflowTimeline.tsx` -- Reusable timeline component (reference pattern for activity feed)
- `src/components/recommendations/RecommendationsPortfolio.tsx` -- Advisor portfolio view (extend with engagement column)

### Schema
- `prisma/schema.prisma` -- SolutionMilestone (line ~2008), SolutionActivity (line ~2030), AssessmentRecommendation lifecycle fields, MilestoneStatus/MilestoneSource enums
- `src/lib/actions/guidance-schemas.ts` -- Zod validation schemas for task/validation status updates

### Server Actions
- `src/lib/actions/admin-recommendation-actions.ts` -- Admin CRUD patterns
- `src/lib/actions/enterprise-recommendation-actions.ts` -- Enterprise management patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SolutionMilestone` model already exists with status, source, sortOrder, completedAt. Needs BLOCKED and DEFERRED added to MilestoneStatus enum.
- `SolutionActivity` model already exists as append-only log with action (varchar 60), detail (JSON), indexed on assessmentRecommendationId + createdAt. Ready for activity feed queries.
- `solution-lifecycle.ts` already logs activities atomically on every status transition via transitionRecommendationStatus(). Activity feed reads from this existing data.
- `ProgressDashboard.tsx` already calculates overall completion % and per-recommendation progress. Extend with milestone-level granularity and Next Step callout.
- `ActionCard.tsx` already renders playbook steps and task status dropdown. Extend with read-only milestone checklist visualization.
- `WorkflowTimeline.tsx` provides a reusable timeline pattern with event dots and connectors. Reference for activity feed component design.
- `PortfolioEngagement` model exists for tracking engagement status per client-advisor relationship.

### Established Patterns
- Server actions with Zod validation and role guards (requireAdvisorRole, requireAdminRole)
- TanStack React Table for advisor portfolio views
- React Suspense streaming for dashboard performance
- Transactional activity logging (Prisma $transaction wrapping status change + activity insert)
- Role-based field visibility (hiddenFromClient, requiresValidation)
- Time horizon grouping (immediate / strategic / ongoing)

### Integration Points
- updateMilestoneStatus() in solution-lifecycle.ts -- extend to support BLOCKED/DEFERRED with reason fields
- Auto-completion detection should hook into updateMilestoneStatus() after each milestone state change
- Engagement column needs data from a new aggregation query over AssessmentRecommendation + SolutionMilestone per client
- Activity feed component reads SolutionActivity table, filtered by client's assessmentRecommendationIds
- Enterprise feature flag needs new field on enterprise/subscription model

</code_context>

<specifics>
## Specific Ideas

- "Zero noise" is the guiding principle: advisors who skip tracking see exactly what they see today
- Activity feed should feel like GitHub/Linear -- lightweight, scannable, chronological
- "Next Step" callout is the most valuable single addition to the client Action Plan view
- Engagement dashboard is for advisors who manage multiple clients through implementation -- think portfolio-level operational view
- Blocked milestones are a signal to the advisor that a client needs attention -- surface this prominently in the portfolio
- The enterprise feature flag pattern established here may be reused for future opt-in features

</specifics>

<deferred>
## Deferred Ideas

- Reminder/notification engine for upcoming milestones and overdue items -- Phase 24 reassessment scheduling
- Client-to-client collaboration on shared action items (family members co-owning actions)
- Integration with external project management tools
- AI-powered stall detection and re-engagement suggestions
- Bulk milestone operations for advisors managing many clients
- Export engagement metrics to PDF reports -- Phase 25 executive reporting

</deferred>

---

*Phase: 23-client-engagement-tracking*
*Context gathered: 2026-06-27*
