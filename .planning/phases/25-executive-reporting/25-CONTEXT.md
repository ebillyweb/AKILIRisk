# Phase 25: Executive Reporting - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate executive-grade reports that tell the full risk reduction story -- not just scores, but a strategic business review spanning multiple assessments, multiple risk domains, recommendation progress, score deltas with attribution, qualitative impact assessment, and next steps. Two output types: a client-facing Executive Report (polished, shareable with boards/trustees/attorneys) and a companion Advisor Brief (internal meeting prep with advisor notes, discussion prompts, and follow-up items). Both are generated from the same underlying ExecutiveReportSnapshot.

</domain>

<decisions>
## Implementation Decisions

### Report Architecture

- **D-01:** New report type (ExecutiveReport) with its own snapshot schema (`ExecutiveReportSnapshot`), separate from the existing single-assessment `ReportSnapshot`. Shares PDF rendering infrastructure (branding, templates, styling, headers/footers) but keeps data builders and schemas independent.
- **D-02:** Establishes a shared report framework pattern: Shared Report Framework (branding, rendering, PDF pipeline) + Specialized Report Types (AssessmentReport, ExecutiveReport, future types). Clean foundation for Board Reports, Annual Strategic Reviews, Enterprise Portfolio Reports without overloading the assessment model.
- **D-03:** Reuses Draft -> Published -> Superseded lifecycle with snapshot immutability at publish time. Executive Report is a formal, auditable record of what the advisor communicated to the client. Published reports remain unchanged as underlying data evolves.

### Report Scope and Sections

- **D-04:** Hybrid section model -- core sections always present (with brief zero-state messaging when data is sparse), advanced sections conditional on data availability.
- **D-05:** Always-present core sections: Executive Summary, Overall Risk Profile, Top Risk Priorities, Strategic Action Plan Summary, Advisor Recommendations, Next Recommended Steps.
- **D-06:** Conditional sections (included when data exists): Risk Trend Analysis (requires multiple assessments), Score Deltas / Risk Improvement (requires reassessment), Implementation Progress (requires engagement tracking), Risk Intelligence Timeline excerpt (requires meaningful activity), Strategic Impact summary (qualitative, always; financial only when methodology supports it).
- **D-07:** Zero-state messaging for conditional sections: concise forward-looking text (e.g., "Trend reporting will become available after the next reassessment") rather than empty pages or silent omission.
- **D-08:** Report tells a strategic narrative arc: (1) Where are we today? (2) What have we accomplished? (3) How has the risk profile changed? (4) What should we focus on next?

### Overall Risk Profile

- **D-09:** Per-pillar reporting with an Executive Readiness indicator -- NO mathematical composite score. Each pillar presented independently (Governance, Ownership, Succession, Estate, Cybersecurity, etc.) because domains represent fundamentally different risk types.
- **D-10:** Executive Readiness summary communicates overall posture without false mathematical precision: Overall Readiness tier (Developing / Mature / Advanced), Highest Risk Domains, Strongest Domains, Recommended Strategic Priorities.
- **D-11:** Future composite scoring deferred -- if introduced, must be configurable enterprise methodology with transparent weighting, not a platform-wide default.

### Score Delta Presentation

- **D-12:** Hybrid executive comparison per pillar: Previous Score, Current Score, Delta (e.g., +1.8), Trend indicator (Improved/Declined/Stable), and Primary drivers of the change (completed recommendations attributed to the delta).
- **D-13:** The goal is to explain WHY scores changed, not just that they changed. Key drivers listed with checkmarks (e.g., "Governance Charter adopted", "Decision authority documented").

### Trend Visualization in PDF

- **D-14:** Native react-pdf drawing primitives for all PDF visualizations (sparklines, progress bars, horizontal comparisons, score deltas). No server-side chart rendering dependency (no puppeteer, satori, or recharts-to-png).
- **D-15:** The web application remains the rich analytics experience. PDF is optimized for readability, portability, and long-term reliability as a polished executive summary.
- **D-16:** Server-side chart rendering only introduced if a future requirement cannot be represented with native PDF primitives.

### Report Audience

- **D-17:** Executive Report is client-facing by default -- polished, presentation-quality, shareable with clients, family members, boards, trustees, attorneys, and professional partners. No advisor-internal language or workflow commentary.
- **D-18:** Companion Advisor Brief generated from the same ExecutiveReportSnapshot, containing: advisor notes, meeting agenda, discussion prompts, internal priorities, deferred recommendations, follow-up reminders, client engagement insights.
- **D-19:** Two separate documents from one data source, not a toggle within a single report.

### Report Generation

- **D-20:** On-demand generation by advisor from client detail view, plus scheduled draft generation tied to ReviewCadence (quarterly/semi-annual/annual).
- **D-21:** Scheduled reports auto-generate as drafts -- never auto-distributed. Advisor reviews, optionally adds commentary, then explicitly publishes.
- **D-22:** Default reporting window: "Since Last Published Executive Report." First report covers all time.
- **D-23:** Advisor can override with preset periods (Last 90 Days, Last 6 Months, Last 12 Months, Since First Assessment) or custom date range.
- **D-24:** Reporting period clearly displayed in report header (e.g., "Reporting Period: January 1, 2027 -- June 30, 2027").

### Financial Exposure / Strategic Impact

- **D-25:** Financial exposure is a progressive capability, NOT a Phase 25 hard requirement. Phase 25 implements Phase 1 of a three-phase approach.
- **D-26:** Phase 25 (this phase): Qualitative impact only -- Critical / High / Medium / Low per recommendation. Focus on measurable risk posture improvement rather than speculative dollar values.
- **D-27:** Impact level derived by default from recommendation risk score, pillar weight, and metadata. Advisors can override when client-specific context changes business significance. Overrides are audited and attributed.
- **D-28:** Future Phase 2: Optional advisor-entered financial estimates, clearly identified as advisor opinions. Future Phase 3: Platform-supported financial methodology with transparent, explainable, enterprise-configurable models.

### Claude's Discretion

- ExecutiveReportSnapshot schema design (structure, versioning, field layout)
- Shared report framework refactoring (extracting common rendering infrastructure)
- Executive Readiness tier derivation algorithm (mapping pillar scores to Developing/Mature/Advanced)
- Impact level derivation formula (risk score + pillar weight + metadata -> Critical/High/Medium/Low)
- Advisor Brief format and layout
- Scheduled draft generation integration with existing ReviewCadence/cron infrastructure
- PDF component architecture for executive report sections
- Report generation UI placement in advisor client detail view
- Date range picker component design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing PDF Infrastructure (share, don't duplicate)
- `src/lib/pdf/render-report.tsx` -- Pure render pattern: snapshot + branding -> PDF bytes. Reference for executive report renderer.
- `src/lib/pdf/build-report-snapshot.ts` -- Assessment report snapshot builder. Reference pattern for ExecutiveReportSnapshot builder.
- `src/lib/pdf/branding-integration.ts` -- Advisor branding for PDF (logo, firm name, colors). Reuse directly.
- `src/lib/pdf/enhanced-styles.ts` -- Dynamic PDF styling with advisor branding. Reuse directly.
- `src/lib/pdf/components/EnhancedReportCover.tsx` -- Branded cover page. Reuse/extend.
- `src/lib/pdf/components/EnhancedPageFooter.tsx` -- Branded footer. Reuse directly.
- `src/lib/pdf/components/ExecutiveSummary.tsx` -- Existing executive summary component. Reference for executive report summary.
- `src/lib/pdf/styles.ts` -- Base PDF styles. Reuse directly.

### Report Lifecycle
- `src/app/api/reports/[id]/pdf/route.tsx` -- Existing report PDF route (auth, snapshot resolution, render). Reference for executive report route.
- `src/app/api/reports/by-id/[reportId]/pdf/route.tsx` -- Strict-snapshot route. Reference for immutable published report serving.

### Score Deltas and Reassessment (Phase 24)
- `prisma/schema.prisma` -- Assessment model (previousAssessmentId chain, version), PillarScore model, ReviewCadence model
- `.planning/phases/24-continuous-risk-improvement/24-CONTEXT.md` -- Reassessment decisions, score delta presentation, intelligence timeline, ReviewCadence engine

### Recommendations and Engagement (Phases 22-23)
- `src/lib/recommendations/solution-lifecycle.ts` -- State machine, SolutionActivity logging
- `src/lib/recommendations/guidance-package.ts` -- Per-client recommendation aggregation
- `src/lib/actions/client-action-plan-actions.ts` -- Client action plan data fetching
- `src/lib/engagement/engagement-metrics.ts` -- Engagement aggregation queries
- `.planning/phases/22-recommendation-experience/22-CONTEXT.md` -- Strategic Action Plan design, lifecycle states, three-layer composition
- `.planning/phases/23-client-engagement-tracking/23-CONTEXT.md` -- Activity feed, engagement metrics, milestone tracking, feature flags

### Analytics and Trends (web components, reference only)
- `src/components/analytics/GovernanceTrendChart.tsx` -- Recharts trend chart (web only, not PDF-compatible)
- `src/components/analytics/AssessmentComparisonView.tsx` -- Assessment comparison view
- `src/lib/analytics/queries.ts` -- Analytics data fetching patterns

### Cron Infrastructure
- `src/app/api/cron/` -- Existing cron route pattern for scheduled report generation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderReportPdf()` in `render-report.tsx` -- pure render pattern (snapshot + branding -> bytes). Same pattern for executive reports with different snapshot type.
- `buildReportSnapshot()` / `buildBrandingSnapshot()` -- builder pattern for assembling snapshot data from Prisma. Executive report needs equivalent `buildExecutiveReportSnapshot()`.
- `EnhancedReportCover`, `EnhancedPageFooter`, `DraftWatermark` -- shared PDF components reusable across report types.
- `createBrandedPDFMetadata()` -- branded metadata generation, reuse directly.
- `PillarScore` model with per-pillar scores, breakdown JSON, and riskLevel -- foundation for per-pillar executive reporting.
- `Assessment.previousAssessmentId` chain -- enables score delta computation across reassessments.
- `SolutionActivity` append-only log -- source for timeline excerpts and engagement metrics.
- `ReviewCadence` model -- ties into scheduled report generation.
- `computePillarDeltas` (Phase 24) -- pure function for score comparison between assessments.

### Established Patterns
- Report Draft/Published/Superseded lifecycle with snapshotData JSON column
- Server actions with Zod validation and role guards (requireAdvisorRole)
- React Suspense streaming for dashboard data loading
- Prisma $transaction for atomic multi-table writes
- Enterprise feature flag gating (Phase 23 pattern)
- date-fns for date formatting and computation

### Integration Points
- New `ExecutiveReport` model (or reportType field on existing Report model) with `executiveSnapshotData` JSON column
- Executive report generation UI in advisor client detail view
- New API route for executive report PDF rendering
- ReviewCadence integration for scheduled draft generation via existing cron infrastructure
- Impact level derivation needs access to recommendation priority, pillar weight, and metadata

</code_context>

<specifics>
## Specific Ideas

- The Executive Report should read as a strategic business review, not a collection of assessment results
- Score deltas must explain WHY scores changed with attributed drivers, not just show numerical differences
- Executive Readiness tiers (Developing/Mature/Advanced) avoid false precision of composite scores while giving executives a headline indicator
- "Trend reporting will become available after the next reassessment" -- forward-looking zero-state messaging, not empty sections
- Advisor Brief is a separate document, not a "toggle" on the client-facing report -- keeps the Executive Report clean for external sharing
- Scheduled reports as drafts, never auto-distributed -- advisor always controls the client relationship
- Financial exposure modeling deferred to avoid false precision; qualitative impact (Critical/High/Medium/Low) is the Phase 25 deliverable
- Event-driven report generation prompts (e.g., "AKILI recommends generating an updated report based on 3 completed recommendations") -- deferred to future enhancement

</specifics>

<deferred>
## Deferred Ideas

- Event-driven report generation recommendations (significant milestones trigger report suggestions) -- future enhancement
- Financial exposure Phase 2: advisor-entered dollar estimates per recommendation
- Financial exposure Phase 3: platform-supported financial methodology with enterprise configuration
- Board Reports / Annual Strategic Reviews / Enterprise Portfolio Reports -- future report types using the shared framework
- AI-powered executive summary generation (natural language insights)
- Report delivery via email with branded templates
- Client self-service report generation
- Composite risk scoring with configurable enterprise methodology

</deferred>

---

*Phase: 25-executive-reporting*
*Context gathered: 2026-06-27*
