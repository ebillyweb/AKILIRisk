# Phase 24: Continuous Risk Improvement - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the assessment loop -- clients can reassess (full, pillar-scoped, or targeted follow-up), see per-pillar score deltas with attribution to completed recommendations, and measure the impact of their risk reduction work. A Review Cadence Engine manages reassessment scheduling with enterprise defaults, advisor overrides, and system-initiated recommendations. The Phase 23 activity timeline evolves to include intelligence events (assessment completions, score changes, cadence triggers, recommendation impact).

</domain>

<decisions>
## Implementation Decisions

### Reassessment Scope

- **D-01:** Three reassessment types: (1) Full Assessment -- annual review, significant life event, major ownership change. (2) Domain/Pillar Reassessment -- retake a single pillar (Governance, Estate, Cybersecurity, etc.). (3) Targeted Follow-up -- re-ask only questions whose answers drove specific completed recommendations.
- **D-02:** All reassessment types start fresh (no pre-filled answers). Previous assessment preserved as-is for comparison.
- **D-03:** Targeted follow-up uses recommendation-linked question selection: system identifies which questions drove which recommendations, and when those recommendations are completed, re-asks those questions to measure impact.
- **D-04:** Assessment versioning links new assessment to previous via chain (e.g., `previousAssessmentId`). Version number increments.

### Score Delta Presentation

- **D-05:** Per-pillar comparison cards showing: previous score, current score, delta (absolute + direction), and "why it improved/regressed" attribution listing completed recommendations that drove the change.
- **D-06:** Pillars with no activity show "No change -- No new planning activity" (explicit zero-state, not hidden).
- **D-07:** Score deltas visible to both client and advisor. Client sees their improvement on their dashboard. Advisor sees same data in client detail view. Both see the attribution.

### Review Cadence Engine

- **D-08:** Enterprise sets default cadence (Annual, Semi-annual, Quarterly). Advisor can override per client.
- **D-09:** System can also recommend reassessments based on events (e.g., recommendation completion thresholds, pillar with many completed actions but no reassessment).
- **D-10:** This is a Review Cadence Engine, not just a reminder engine -- it actively manages the reassessment lifecycle, not just sends notifications.

### Risk Intelligence Timeline

- **D-11:** No separate timeline model. Evolve the Phase 23 SolutionActivity / activity feed to include intelligence events. Phase 24 adds new event types to the existing system.
- **D-12:** New intelligence event types: (a) Assessment events -- started, completed, score calculated, reassessment triggered. (b) Score change events -- per-pillar deltas, risk level transitions, attribution to recommendations. (c) Review cadence events -- due date approaching, overdue, cadence changed, system-recommended reassessment. (d) Recommendation impact events -- completion milestones, measured impact after reassessment, effectiveness rating.

### Claude's Discretion

- Assessment versioning schema design (previousAssessmentId link vs separate version table)
- Targeted follow-up question selection algorithm (how to map questions to recommendations)
- Review cadence engine scheduling mechanism (cron job vs event-driven vs hybrid)
- Score delta computation approach (direct comparison vs weighted diff)
- Timeline event schema extension strategy (new action types in SolutionActivity vs new model)
- Reassessment UI flow (reuse existing assessment flow vs separate reassessment flow)
- System-recommended reassessment trigger thresholds

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Assessment & Scoring
- `prisma/schema.prisma` -- Assessment model (version field, startedAt, completedAt, lastRescoredAt), PillarScore model (assessmentId + pillar unique, score, riskLevel, breakdown)
- `src/lib/assessment/` -- Assessment engine, pillar scoring, question flow

### Analytics & Trends (existing)
- `src/lib/analytics/queries.ts` -- Existing analytics data fetching
- `src/lib/analytics/types.ts` -- Analytics type definitions
- `src/components/analytics/GovernanceTrendChart.tsx` -- Trend chart component (reusable pattern)
- `src/components/family/ScoreTrendChart.tsx` -- Score trend visualization
- `src/app/(protected)/advisor/analytics/[clientId]/page.tsx` -- Advisor analytics page pattern (SSR + Suspense)

### Phase 23 Activity System (extend, don't replace)
- `src/lib/engagement/activity-feed.ts` -- Activity feed queries with role filtering
- `src/lib/recommendations/solution-lifecycle.ts` -- SolutionActivity logging, state machine
- `prisma/schema.prisma` -- SolutionActivity model (action, detail JSON, assessmentRecommendationId)

### Phase 23 Engagement Infrastructure
- `src/lib/engagement/feature-flags.ts` -- Enterprise feature flag pattern
- `src/lib/engagement/engagement-metrics.ts` -- Engagement aggregation queries
- `.planning/phases/23-client-engagement-tracking/23-CONTEXT.md` -- Phase 23 decisions (activity feed, feature flags, milestone lifecycle)

### Recommendation Engine
- `src/lib/recommendations/guidance-package.ts` -- Per-client recommendation deduplication and grouping
- `src/lib/actions/client-action-plan-actions.ts` -- Client action plan data fetching

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Assessment.version` field already exists (Int, default 1, bumped by rescoreAssessment) -- extend for reassessment versioning
- `Assessment.lastRescoredAt` timestamp exists -- reference for reassessment tracking
- `PillarScore` model stores per-pillar scores per assessment with breakdown JSON -- ready for delta computation
- `GovernanceTrendChart` and `ScoreTrendChart` already render multi-assessment score trends -- reuse/extend
- `SolutionActivity` append-only log with action (varchar 60) and detail (JSON) -- extend with new intelligence event action types
- `Assessment.includedPillars` field exists -- supports pillar-scoped reassessment (partial assessment)
- `ClientAdvisorAssignment` with `includedPillars` and `focusAreas` -- per-assignment scope already modeled

### Established Patterns
- Server actions with Zod validation and role guards (requireAdvisorRole)
- Prisma $transaction for atomic multi-table writes
- React Suspense streaming for dashboard data loading
- TanStack React Table for advisor portfolio views
- `date-fns` for date formatting and computation
- Enterprise feature flag gating (Phase 23 pattern)

### Integration Points
- Assessment flow needs a "reassess" entry point that creates a new Assessment linked to previous
- PillarScore comparison needs a query that loads scores for two assessment versions
- SolutionActivity needs new action types for intelligence events (no schema change needed -- `action` is varchar 60)
- Review cadence engine needs a scheduled check (cron API route pattern already exists in `src/app/api/cron/`)
- Recommendation-to-question mapping for targeted follow-up needs to trace back through triggerReason JSON

</code_context>

<specifics>
## Specific Ideas

- Score delta presentation should look like: "Governance: Previous 62, Current 84, +22. Why it improved: Governance Charter completed, Decision authority documented, Family council established"
- Pillars with no change show explicitly: "Estate Score: No Change. Reason: No new planning activity"
- The Review Cadence Engine is a first-class feature, not a notification add-on -- it manages the reassessment lifecycle
- Timeline evolution, not replacement -- Phase 23's activity feed becomes a filtered view of the broader intelligence timeline
- System-recommended reassessments are a differentiator: "AKILI recommends reassessing Governance based on 3 completed recommendations"

</specifics>

<deferred>
## Deferred Ideas

- Client-to-client collaboration on shared assessment responses (family members co-owning)
- AI-powered predictive risk modeling (PREDICT-01, PREDICT-02 in v2)
- External compliance framework mapping
- Automated dark web monitoring integration (IDENTITY-03, IDENTITY-04 in v2)
- Push notification delivery (mobile)

</deferred>

---

*Phase: 24-continuous-risk-improvement*
*Context gathered: 2026-06-27*
