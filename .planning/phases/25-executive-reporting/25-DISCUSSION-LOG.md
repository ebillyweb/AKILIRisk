# Phase 25: Executive Reporting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 25-executive-reporting
**Areas discussed:** Report scope and sections, Trend visualization in PDF, Report generation trigger, Financial exposure data

---

## Report Scope and Sections

### Q1: Section inclusion strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Always all sections | Every section appears with zero-state for missing data | |
| Conditional sections | Only include sections where data exists | |
| You decide | Let Claude pick | |

**User's choice:** Hybrid model (freeform response)
**Notes:** Core sections always present (Executive Summary, Overall Risk Profile, Top Risk Priorities, Strategic Action Plan Summary, Advisor Recommendations, Next Recommended Steps). Advanced sections conditional on data (Risk Trend Analysis, Score Deltas, Implementation Progress, Timeline, Financial Exposure). Zero-state messaging for conditional sections. Report tells a strategic narrative: Where are we? What have we accomplished? How has risk changed? What's next?

### Q2: Report type architecture

| Option | Description | Selected |
|--------|-------------|----------|
| New report type | Separate ExecutiveReport with own snapshot schema | |
| Extend existing | Evolve current Report model with reportType field | |
| You decide | Let Claude decide | |

**User's choice:** New report type (freeform elaboration)
**Notes:** ExecutiveReportSnapshot separate from ReportSnapshot. Share rendering infrastructure. Establishes shared report framework pattern for future report types.

### Q3: Overall risk profile presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Per-pillar only | Each pillar independently, no composite score | |
| Composite + per-pillar | Weighted composite alongside per-pillar breakdown | |
| You decide | Let Claude decide | |

**User's choice:** Per-pillar with Executive Readiness indicator (freeform elaboration)
**Notes:** No mathematical composite score. Executive Readiness tiers (Developing/Mature/Advanced) with Highest Risk Domains, Strongest Domains, Recommended Strategic Priorities. Future composite scoring deferred as configurable enterprise methodology.

### Q4: Report audience

| Option | Description | Selected |
|--------|-------------|----------|
| Client-facing | Shareable externally, no advisor internals | |
| Advisor review tool | Includes advisor notes, internal rationale | |
| Both with toggle | Single report with advisor toggle | |

**User's choice:** Client-facing + separate Advisor Brief (freeform elaboration)
**Notes:** Executive Report is client-facing by default. Companion Advisor Brief is a separate document from the same snapshot, not a toggle. Contains advisor notes, meeting agenda, discussion prompts, internal priorities, deferred recommendations, follow-up reminders.

---

## Trend Visualization in PDF

### Q1: Chart rendering approach

| Option | Description | Selected |
|--------|-------------|----------|
| react-pdf primitives | Draw with built-in SVG/drawing primitives | |
| Server-side image render | Recharts to PNG/SVG via puppeteer/satori | |
| Simplified table format | Styled table with arrows, no charts | |
| You decide | Let Claude pick | |

**User's choice:** Native react-pdf primitives (freeform elaboration)
**Notes:** Executive-friendly visualizations (sparklines, progress bars, horizontal comparisons, score deltas) using react-pdf drawing primitives. Web app remains the rich analytics experience. PDF optimized for readability and portability.

### Q2: Score delta visualization format

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side bars | Horizontal bar pairs with color-coded delta | |
| Table with arrows | Structured table with direction arrows | |
| You decide | Let Claude pick | |

**User's choice:** Hybrid executive comparison (freeform elaboration)
**Notes:** Per pillar: Previous Score, Current Score, Delta, Trend indicator, Primary drivers of the change. Goal is to explain WHY scores changed with attributed completed recommendations.

---

## Report Generation Trigger

### Q1: Generation trigger model

| Option | Description | Selected |
|--------|-------------|----------|
| Advisor on-demand only | Manual generation from client detail view | |
| On-demand + scheduled | Both with scheduled drafts for advisor review | |
| You decide | Let Claude decide | |

**User's choice:** On-demand + scheduled (freeform elaboration)
**Notes:** Advisor on-demand plus scheduled draft generation tied to ReviewCadence. Scheduled reports auto-generate as drafts, never auto-distributed. Advisor reviews and explicitly publishes. Event-driven generation deferred to future.

### Q2: Date range selection

| Option | Description | Selected |
|--------|-------------|----------|
| Configurable window | Advisor selects start/end or preset period | |
| Since last report | Auto from last published to now | |
| Both options | Default since last report, allow override | |

**User's choice:** Both options
**Notes:** Default "Since Last Published Executive Report." Override with Last 90 Days, Last 6 Months, Last 12 Months, Since First Assessment, or Custom Date Range. Reporting period displayed in report header.

### Q3: Report lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Same lifecycle (Recommended) | Draft/Published/Superseded with snapshots | |
| Simpler model | Generate and download, no persisted state | |
| You decide | Let Claude decide | |

**User's choice:** Same lifecycle (Draft/Published/Superseded)
**Notes:** Executive Report is a formal, auditable record. Published reports immutable via snapshot. Supports longitudinal history and future board reporting/compliance.

---

## Financial Exposure Data

### Q1: Financial exposure data source

| Option | Description | Selected |
|--------|-------------|----------|
| Advisor-entered estimates | Manual per-recommendation financial impact | |
| Platform methodology | Platform-defined impact ranges per type | |
| Defer financial data | Remove from Phase 25 scope | |
| Qualitative framing | Critical/High/Medium/Low, no dollar amounts | |

**User's choice:** Progressive capability (freeform elaboration)
**Notes:** Phase 1 (Phase 25): Qualitative impact only (Critical/High/Medium/Low). Phase 2 (future): Optional advisor-entered estimates. Phase 3 (future): Platform financial methodology. Keeps report credible, avoids false precision.

### Q2: Impact level derivation

| Option | Description | Selected |
|--------|-------------|----------|
| Derive from priority | Map priority 1-10 to impact tiers | |
| Separate field | New Strategic Impact field, independent of priority | |
| You decide | Let Claude decide | |

**User's choice:** Derived by default, advisor-overridable (freeform elaboration)
**Notes:** Platform calculates initial impact from risk score, pillar weight, and metadata. Advisors can override when client context changes significance. Overrides audited and attributed.

---

## Claude's Discretion

- ExecutiveReportSnapshot schema design
- Shared report framework refactoring
- Executive Readiness tier derivation algorithm
- Impact level derivation formula
- Advisor Brief format and layout
- Scheduled draft generation integration with ReviewCadence/cron
- PDF component architecture for executive report sections
- Report generation UI placement
- Date range picker component design

## Deferred Ideas

- Event-driven report generation recommendations
- Financial exposure Phase 2 (advisor-entered) and Phase 3 (platform methodology)
- Board Reports / Annual Strategic Reviews / Enterprise Portfolio Reports
- AI-powered executive summary generation
- Report delivery via email
- Client self-service report generation
- Composite risk scoring with configurable enterprise methodology
