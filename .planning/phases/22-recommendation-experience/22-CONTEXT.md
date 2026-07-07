# Phase 22: Recommendation Experience - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the three-role recommendation experience: advisors review and curate a holistic client Guidance Package, enterprises customize platform assets through an inheritance overlay model, and clients receive a Strategic Action Plan that preserves the full chain of reasoning from assessment evidence through implementation steps. Phase 22 also establishes the generic Platform Asset Catalog inheritance engine (schema + composition), with recommendations as the first consumer and UI. Other asset types adopt the framework in future phases.

</domain>

<decisions>
## Implementation Decisions

### Advisor Guidance Review

- **D-01:** Dedicated per-client Guidance Review page (not per-assessment or per-pillar). Advisors review a single holistic guidance package synthesized across ALL completed assessments for a client.
- **D-02:** The guidance package is a living, cumulative artifact. New assessments enrich the existing package -- recommendations are de-duplicated, merged, reprioritized, or retired based on the complete picture, not recreated independently per assessment.
- **D-03:** Guidance Review page sections: Executive Summary (overall risk profile + top priorities), Profile Insights (synthesized across assessments), Attention Items (family, ownership, governance, succession issues), Recommended Actions (prioritized by urgency/impact regardless of originating assessment), Evidence (supporting assessment responses + documents), Implementation Plan (what advisor includes in the client's Strategic Action Plan).
- **D-04:** Each recommendation in the review shows: Insight (what AKILI discovered), Evidence (triggering assessment questions and responses displayed inline), Why It Matters, Recommended Action, Layer Attribution (Platform/Enterprise/Advisor sources), and Advisor Controls.
- **D-05:** Advisor controls: Accept, Defer, Mark Already Addressed, Hide from Client, Add Advisor Notes, Adjust Priority. The advisor is curating guidance, not approving/rejecting AI logic.
- **D-06:** AKILI sets initial priority order by urgency score. Advisor can override individual items (bump up/down: high/medium/low) but does not manually sort the full list.

### Recommendation Lifecycle

- **D-07:** Simplified implementation-focused lifecycle replacing the approval-centric model:
  - Generated -> Reviewed -> Included in Action Plan -> In Progress -> Completed
- **D-08:** "Defer" means "acknowledged as appropriate but not yet actionable." Deferred recommendations capture: required reason, optional revisit date, optional trigger event (e.g., "After business valuation is complete"), and advisor notes. Deferred items remain visible in the Guidance Package under "Future Considerations" / "Deferred Actions" and are re-evaluated during reassessments. Defer = "Not now," not "Hide this."

### Platform Asset Catalog & Inheritance Engine

- **D-09:** Build a generic, asset-agnostic inheritance/composition engine in Phase 22. Recommendations are the first consumer. Future asset types (Assessments, Questions, Insights, Attention Items, Playbooks, Reports, Templates, Documents) adopt the same framework without redesign.
- **D-10:** Four-layer inheritance model: Platform -> Enterprise Overlay -> Advisor Customization -> Client Output.
- **D-11:** Each platform asset declares an override policy governing what downstream layers can customize. Three tiers:

  **Always Protected** (cannot be suppressed by any layer):
  - Platform Insight
  - Why this matters
  - Evidence
  - Explainability
  - Risk rationale
  - Confidence
  - Supporting assessment data

  **Configurable** (can be added, hidden, or replaced by enterprise/advisor):
  - Implementation guidance
  - Preferred vendors
  - Internal playbooks
  - Estimated cost
  - Estimated timeline
  - Required documents
  - Compliance language
  - Report wording
  - Advisor prompts
  - Educational resources

  **Enterprise Additions** (always appendable):
  - Firm-specific guidance
  - Internal procedures
  - Compliance requirements
  - Links, templates, contacts
  - Provider recommendations

- **D-12:** Advisor layer can: hide enterprise guidance for a specific client, add client-specific notes, change implementation timing, add discussion topics. Advisors can never alter platform insight or evidence.

### Enterprise Customization Interface

- **D-13:** Dedicated Enterprise Guidance section using inline inheritance model. Enterprise admins browse the platform catalog and create overlays, not copies.
- **D-14:** Enterprise overlay fields per platform recommendation: Enable/Disable for org, Required vs Optional, Enterprise priority adjustments (without changing platform risk score), Custom implementation guidance, Firm-specific playbooks, Preferred vendors or internal departments, Legal/compliance disclosures, Expected costs and timelines, Report wording and branding, Internal links/documents/templates.
- **D-15:** UI always distinguishes Platform Definition (immutable recommendation, trigger conditions, evidence, explainability, platform priority) from Enterprise Overlay (firm guidance, preferred implementation, compliance requirements, vendor preferences, branding, playbooks, documentation). Inheritance visualization, not duplication.

### Client Strategic Action Plan

- **D-16:** Rename from "Family Roadmap" to "Strategic Action Plan." Applies to individuals, families, and business owners; aligns with the advisory role.
- **D-17:** The Strategic Action Plan answers four questions: Where are we today? What should we address first? Why does it matter? How will we know we're making progress?
- **D-18:** Strategic Action Plan sections:
  - **Executive Summary:** Overall readiness score, top priorities, key risks requiring discussion, recently completed actions.
  - **Immediate Priorities (0-90 days):** Each action includes: what we're recommending, why it matters, expected outcome, owner, estimated effort, status, supporting insight.
  - **Strategic Initiatives (3-12 months):** Succession planning, governance, family education, estate planning, business continuity.
  - **Ongoing Practices:** Recurring activities (annual governance review, estate review, family risk reassessments).
  - **Progress Dashboard:** Completed initiatives, overall progress, next milestone, upcoming review dates.
- **D-19:** Each action preserves the full chain of reasoning: Why this was recommended (assessment evidence) -> Expected Benefit -> Supporting Insights (specific assessment findings) -> Implementation Guidance (steps) -> Success Criteria. The client always understands WHY something matters.

### Action Ownership Model

- **D-20:** Separate Role from Assignee on every action.
  - **Responsible Role** (platform-defined list): Client, Primary Advisor, Co-Advisor, Attorney, CPA, Financial Planner, Insurance Professional, Business Consultant, Trustee, Family Office, Business Owner, Successor, Board of Directors, Family Council, Other. Supports multiple roles per action. Used for reporting, filtering, analytics, and future workflow automation.
  - **Assignee** (client-specific, freeform): Advisor optionally assigns to a specific person or organization (e.g., "Jane Smith, CPA", "ABC Law Firm"). Supports multiple assignees. Both fields are editable.

### Client Self-Service & Validation

- **D-21:** Shared ownership model with two distinct status tracks:
  - **Task Status** (client-managed): Not Started, In Progress, Waiting on Someone Else, Ready for Review, Completed.
  - **Validation Status** (advisor-managed): Pending Review, Verified, Needs Follow-up.
- **D-22:** Whether an action requires advisor validation is configurable by platform or enterprise based on the action type. Some actions (e.g., "Schedule a family meeting") need no validation; others (e.g., "Execute Buy-Sell Agreement") require it.

### Layer Attribution Display

- **D-23:** Full transparency for advisors -- all three layers clearly labeled (Platform / Enterprise / Advisor) with source tags on every field. Simplified for clients -- they see the composed result as seamless guidance without layer labels. Enterprise admins see platform + their overlay side by side.

### Claude's Discretion

- Generic asset catalog schema design (table structure, polymorphic vs per-type, JSON vs relational for overlay fields)
- Composition engine implementation approach (query-time composition vs materialized views)
- API design for guidance package endpoints
- Cross-assessment recommendation deduplication algorithm
- UI component architecture and routing structure
- Migration strategy for existing AssessmentRecommendation data to new lifecycle states

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Recommendation Engine & Composition
- `src/lib/assessment/engines/recommendation-engine.ts` -- Core recommendation matching and dedup engine
- `src/lib/recommendations/compose-solution.ts` -- Three-layer composition (platform -> enterprise -> advisor)
- `src/lib/recommendations/solution-lifecycle.ts` -- State machine, milestone hydration on ACCEPTED
- `src/lib/recommendations/solution-queries.ts` -- Composed solution queries
- `src/lib/recommendations/types.ts` -- ComposedSolution, SourceLayerSummary, ComposedPlaybookStep types
- `src/lib/recommendations/format-trigger.ts` -- Trigger reason formatting

### Existing UI
- `src/components/recommendations/RecommendationsPortfolio.tsx` -- Current advisor portfolio view
- `src/components/recommendations/RecommendationsSummaryStrip.tsx` -- Summary stats strip
- `src/components/assessment/FacilitatedRecommendations.tsx` -- Current client-facing recommendation display
- `src/components/advisor/PillarRecommendationsPanel.tsx` -- Advisor intake review panel

### Server Actions & Queries
- `src/lib/actions/admin-recommendation-actions.ts` -- Admin CRUD for catalog
- `src/lib/actions/enterprise-recommendation-actions.ts` -- Enterprise rule management
- `src/lib/recommendations/queries.ts` -- Portfolio recommendation queries
- `src/lib/admin/recommendation-queries.ts` -- Admin catalog/rule queries
- `src/lib/admin/recommendation-rule-schemas.ts` -- Zod validation schemas
- `src/lib/client/assessment-recommendations.ts` -- Client-facing recommendation fetching

### Routes
- `src/app/(protected)/advisor/recommendations/page.tsx` -- Advisor portfolio page
- `src/app/(protected)/advisor/enterprise/recommendations/page.tsx` -- Enterprise recommendation rules
- `src/app/(protected)/admin/recommendations/page.tsx` -- Admin catalog management
- `src/app/api/assessment/[id]/recommendations/route.ts` -- Client recommendations API

### Schema
- `prisma/schema.prisma` -- ServiceRecommendation, AssessmentRecommendation, EnterpriseSolutionCustomization, AdvisorSolutionCustomization, SolutionMilestone, SolutionActivity models
- `prisma/migrations/20260625130000_risk_solutions_library/migration.sql` -- Solutions library migration

### Methodology
- `src/lib/methodology/enterprise-recommendation-queries.ts` -- Enterprise rule loading with cloning
- `src/lib/methodology/advisor-recommendation-starter.ts` -- Advisor rule starter templates

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `compose-solution.ts`: Three-layer composition already implements platform -> enterprise -> advisor precedence with additive playbook merging. Needs extension for the new override policy tiers (protected/configurable/additions).
- `solution-lifecycle.ts`: State machine with `transitionRecommendationStatus()` and `hydrateMilestones()`. Lifecycle states need updating from approval-centric (PENDING/REVIEWED/ACCEPTED/DECLINED/COMPLETED) to implementation-focused (Generated/Reviewed/Included/InProgress/Completed/Deferred).
- `RecommendationsPortfolio.tsx`: Current portfolio view groups by client with action buttons. Can serve as starting point for the new Guidance Review navigation.
- `FacilitatedRecommendations.tsx`: Current client-facing display. Will be replaced by Strategic Action Plan components.
- Hero-surface UI pattern used across advisor dashboard pages -- new guidance review page should follow this established pattern.

### Established Patterns
- Server actions in `src/lib/actions/` with Zod validation and `requireAdminRole()`/`requireAdvisorRole()` guards
- TanStack React Table for data-heavy advisor views
- React Suspense streaming for dashboard performance (<2s load target)
- Recharts for analytics visualizations
- Row-level data isolation via ownership-enforced queries

### Integration Points
- Assessment submission flow calls `RecommendationEngine.generateRecommendations()` -- needs to feed into cumulative guidance package
- Rescore action with transaction wrapping -- needs to trigger guidance package re-evaluation
- Portfolio queries in `src/lib/recommendations/queries.ts` -- need extension for guidance package aggregation
- Client API at `/api/assessment/[id]/recommendations` -- needs new endpoint scoped to client (not assessment) for Strategic Action Plan

</code_context>

<specifics>
## Specific Ideas

- "Strategic Action Plan" is the chosen name (not Family Roadmap, Implementation Roadmap, etc.)
- Action plan sections mirror a strategic advisory document: Executive Summary, Immediate Priorities (0-90 days), Strategic Initiatives (3-12 months), Ongoing Practices, Progress Dashboard
- Each action preserves the full reasoning chain: Why recommended -> Expected Benefit -> Supporting Insights -> Implementation Guidance -> Success Criteria
- Advisor experience should feel like curating client guidance, not approving/rejecting AI output
- Enterprise UI should feel like inheritance visualization (platform definition alongside enterprise overlay), not catalog duplication
- Client experience should feel like following a long-term strategic roadmap, not checking off tasks
- The platform asset catalog pattern (Platform -> Enterprise -> Advisor -> Client) is an architectural principle that should inform all future asset types

</specifics>

<deferred>
## Deferred Ideas

- Generic Platform Asset Catalog UI for non-recommendation asset types (Assessments, Questions, Insights, Playbooks, Reports, Templates, Documents) -- future phases adopt the inheritance engine built here
- Workflow automation based on Responsible Role assignments (e.g., auto-notify assigned attorney)
- Client-to-client collaboration on shared action items (family members co-owning actions)
- Integration with external project management tools for action tracking
- AI-powered recommendation merging and deduplication across assessments (Phase 22 implements rule-based dedup; AI enhancement deferred)

</deferred>

---

*Phase: 22-recommendation-experience*
*Context gathered: 2026-06-26*
