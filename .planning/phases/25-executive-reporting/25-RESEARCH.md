# Phase 25: Executive Reporting - Research

**Researched:** 2026-06-27
**Domain:** PDF report generation, multi-assessment analytics, recommendation lifecycle, cron scheduling
**Confidence:** HIGH

## Summary

Phase 25 builds an ExecutiveReport type on top of the existing PDF infrastructure. The codebase has a mature, well-factored report pipeline: a pure render function (`renderReportPdf`), a snapshot builder (`buildReportSnapshot`), reusable branded PDF components, and a Draft/Published/Superseded lifecycle. The executive report follows the exact same pattern with a new snapshot type (`ExecutiveReportSnapshot`) and a new `Document` component (`ExecutiveReport`).

All data sources for the ExecutiveReportSnapshot already exist and are production-ready: `computePillarDeltas` for score deltas, `getGuidancePackageForClient` for recommendation status counts, `getEngagementMetrics` for milestone progress, `getFamilyGovernanceTrends` for multi-assessment trend data, and `ReviewCadence` for scheduled draft generation. No new Prisma models are strictly required -- the executive report can use a `reportType` discriminator on the existing `Report` model, or a separate `ExecutiveReport` model. Either approach is viable; the CONTEXT.md leans toward a new model.

The main engineering work is: designing the `ExecutiveReportSnapshot` schema, building the snapshot assembler that joins data from multiple models, writing the PDF components (no SVG/chart libraries needed per D-14; use react-pdf View/Text primitives for sparklines and progress bars), wiring the on-demand advisor action and the scheduled cron draft, and creating the Advisor Brief variant from the same snapshot.

**Primary recommendation:** New `ExecutiveReport` Prisma model mirroring the `Report` model shape, with its own `executiveSnapshotData` JSON column. Keeps executive report lifecycle independent and avoids overloading the existing report type union.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Report Architecture**
- D-01: New `ExecutiveReportSnapshot` schema, independent from `ReportSnapshot`. Shares PDF rendering infrastructure but keeps builders and schemas separate.
- D-02: Shared Report Framework (branding/rendering/pipeline) + Specialized types. Foundation for future Board Reports, Annual Strategic Reviews, Enterprise Portfolio Reports.
- D-03: Draft -> Published -> Superseded lifecycle with snapshot immutability. Published reports remain unchanged as underlying data evolves.

**Report Sections**
- D-04: Hybrid -- core sections always present with zero-state messaging; advanced sections conditional on data.
- D-05: Always-present core: Executive Summary, Overall Risk Profile, Top Risk Priorities, Strategic Action Plan Summary, Advisor Recommendations, Next Recommended Steps.
- D-06: Conditional: Risk Trend Analysis (requires multiple assessments), Score Deltas (requires reassessment), Implementation Progress (requires engagement tracking), Intelligence Timeline excerpt, Strategic Impact.
- D-07: Zero-state text, not empty pages.
- D-08: Narrative arc: Where are we today? / What have we accomplished? / How has risk changed? / What next?

**Overall Risk Profile**
- D-09: Per-pillar reporting with Executive Readiness indicator. NO mathematical composite score.
- D-10: Executive Readiness tier: Developing / Mature / Advanced. Highest-risk domains, strongest domains, strategic priorities.
- D-11: Future composite scoring deferred.

**Score Delta Presentation**
- D-12: Per-pillar: Previous Score, Current Score, Delta, Trend indicator, Primary drivers.
- D-13: Explain WHY scores changed with attributed completed recommendations.

**Trend Visualization**
- D-14: Native react-pdf drawing primitives only. No puppeteer, satori, recharts-to-png.
- D-15: Web app is the rich analytics experience; PDF is for readability and portability.
- D-16: Server-side chart rendering only if future requirement cannot use native primitives.

**Report Audience**
- D-17: Executive Report is client-facing. No advisor-internal language.
- D-18: Companion Advisor Brief from same snapshot: advisor notes, meeting agenda, discussion prompts, internal priorities.
- D-19: Two separate documents from one data source.

**Report Generation**
- D-20: On-demand by advisor from client detail view + scheduled drafts tied to ReviewCadence.
- D-21: Scheduled reports are drafts; never auto-distributed.
- D-22: Default window: "Since Last Published Executive Report." First report covers all time.
- D-23: Advisor can override with presets (Last 90/180/365 Days, Since First Assessment) or custom range.
- D-24: Reporting period displayed in report header.

**Financial Exposure**
- D-25/D-26: Phase 25 delivers qualitative impact only (Critical/High/Medium/Low per recommendation).
- D-27: Impact level derived from recommendation risk score, pillar weight, metadata. Advisors can override with audit.
- D-28: Financial Phase 2/3 deferred.

### Claude's Discretion

- ExecutiveReportSnapshot schema design
- Shared report framework refactoring
- Executive Readiness tier derivation algorithm
- Impact level derivation formula
- Advisor Brief format and layout
- Scheduled draft generation integration with ReviewCadence/cron
- PDF component architecture
- Report generation UI placement
- Date range picker component design

### Deferred Ideas (OUT OF SCOPE)

- Event-driven report generation suggestions
- Financial exposure Phase 2/3 (advisor dollar estimates, platform methodology)
- Board Reports / Annual Strategic Reviews / Enterprise Portfolio Reports
- AI-powered executive summary generation
- Report delivery via email
- Client self-service report generation
- Composite risk scoring
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ExecutiveReportSnapshot assembly | API / Backend | — | Pure server-side read aggregating Prisma models across multiple tables |
| Executive Report PDF rendering | API / Backend | — | `renderToBuffer` is server-only; react-pdf has no browser bundle |
| Advisor Brief PDF rendering | API / Backend | — | Same render pipeline, different Document component |
| On-demand report generation UI | Frontend Server (SSR) | Browser | Server action call from advisor client detail view |
| Date range picker | Browser | — | Client-side interaction, pass selected range to server action |
| Scheduled draft generation | Cron / API | — | New cron route invoking builder, writes ExecutiveReport row |
| Report lifecycle (Draft/Published) | API / Backend | — | Server actions mirror existing `publishReport` pattern |
| Impact level derivation | API / Backend | — | Pure function, computed during snapshot assembly |
| Executive Readiness tier | API / Backend | — | Pure function, computed during snapshot assembly |

---

## Standard Stack

### Core (all already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@react-pdf/renderer` | ^4.3.2 [VERIFIED: package.json] | PDF generation | Already installed; `Page`, `View`, `Text`, `Image`, `Document`, `StyleSheet`, `renderToBuffer` |
| `prisma` | (project version) | DB access | All required models exist |
| `date-fns` | (project version) | Date math for reporting windows | Already used in engagement-metrics.ts |
| `next` | 16+ | API routes, server actions | App Router pattern established |

### Supporting (already in project)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zod` | (project version) | Input validation on server actions | Existing pattern in guidance-schemas.ts |

**No new npm packages required for Phase 25.** All dependencies are already installed.

---

## Package Legitimacy Audit

Not applicable. Phase 25 installs no new packages.

---

## Architecture Patterns

### System Architecture Diagram

```
Advisor Client Detail View (Browser)
        |
        | Server Action: generateExecutiveReport(clientId, options)
        v
buildExecutiveReportSnapshot(clientId, options)   [src/lib/pdf/build-executive-snapshot.ts]
        |
        +-- prisma.assessment.findMany (all completed, ordered asc)
        |       |-- .previousAssessmentId chain -> current + previous assessment pair
        |       +-- pillarScores (per assessment)
        |
        +-- computePillarDeltas(prev, curr, completedRecs)  [analytics/score-delta.ts -- REUSE]
        |
        +-- getGuidancePackageForClient(clientId, advisorId)  [REUSE]
        |       +-- recommendation counts by status
        |
        +-- engagement milestones (milestone completion %)  [engagement-metrics.ts -- REUSE]
        |
        +-- SolutionActivity feed (intelligence timeline excerpt)
        |
        +-- ReviewCadence (next due date)
        |
        v
ExecutiveReportSnapshot (JSON, stored in DB)
        |
        +-- renderExecutiveReportPdf(snapshot, branding, variant: 'client' | 'advisor')
        |       |
        |       +-- ExecutiveReportDocument [new]  (Document with 8-section structure)
        |               +-- ReportCover [EnhancedReportCover -- REUSE]
        |               +-- ExecutiveReadinessPage [new]
        |               +-- OverallRiskProfilePage [new]  (per-pillar, no composite)
        |               +-- ScoreDeltaPage [new, conditional]
        |               +-- ImplementationProgressPage [new, conditional]
        |               +-- TopPrioritiesPage [new]
        |               +-- AdvisorRecommendationsPage [new]
        |               +-- NextStepsPage [new]
        |               +-- IntelligenceTimelinePage [new, conditional]
        |               + (Advisor Brief variant adds: AdvisorBriefPage, MeetingAgendaPage)
        |               +-- EnhancedPageFooter [REUSE]
        |               +-- DraftWatermark [REUSE]
        |
        v
PDF bytes -> NextResponse (Content-Type: application/pdf)

Cron path: GET /api/cron/executive-report-drafts
        |
        +-- ReviewCadence rows where nextDueDate approaching
        +-- buildExecutiveReportSnapshot(clientId, ...)
        +-- prisma.executiveReport.create({ status: DRAFT, snapshotData })
```

### Recommended Project Structure

```
src/lib/pdf/
├── build-executive-snapshot.ts    # new: ExecutiveReportSnapshot assembler
├── render-executive-report.tsx    # new: pure render for executive report
├── executive-report-types.ts      # new: ExecutiveReportSnapshot interface + helpers
├── components/
│   ├── ExecutiveReport.tsx        # new: top-level Document component
│   ├── ExecutiveReadinessPage.tsx # new: Developing/Mature/Advanced indicator
│   ├── OverallRiskProfilePage.tsx # new: per-pillar score display
│   ├── ScoreDeltaPage.tsx         # new: delta + attribution (conditional)
│   ├── ImplementationProgressPage.tsx  # new: milestone completion (conditional)
│   ├── TopPrioritiesPage.tsx      # new: high-impact open recommendations
│   ├── AdvisorRecommendationsPage.tsx  # new: advisor-authored recommendations
│   ├── NextStepsPage.tsx          # new: next recommended steps
│   ├── IntelligenceTimelinePage.tsx    # new: activity timeline (conditional)
│   ├── AdvisorBriefPage.tsx       # new: advisor-only variant pages
│   └── [existing components -- unchanged]

src/lib/actions/
└── executive-report-actions.ts    # new: generateExecutiveReport, publishExecutiveReport

src/app/api/
├── executive-reports/[id]/pdf/route.tsx   # new: serve published/draft PDF
└── cron/executive-report-drafts/route.ts  # new: scheduled draft generation
```

### Pattern 1: ExecutiveReportSnapshot Schema (Claude's Discretion)

**What:** JSON stored in `executiveSnapshotData` at publish time. Assembles multi-assessment data into a single frozen object.

```typescript
// src/lib/pdf/executive-report-types.ts
export interface ExecutiveReportSnapshot {
  schemaVersion: 1;
  reportingPeriod: {
    start: string;   // ISO date
    end: string;     // ISO date
    label: string;   // "January 1, 2026 – June 27, 2026"
  };
  clientName: string;
  generatedAt: string;  // ISO datetime

  // Per-pillar current state (D-09)
  pillarReadiness: PillarReadiness[];

  // Executive Readiness tier (D-10) -- Claude's Discretion to derive
  executiveReadiness: {
    tier: "Developing" | "Mature" | "Advanced";
    highestRiskDomains: string[];
    strongestDomains: string[];
    strategicPriorities: string[];
  };

  // Score deltas (conditional, only if previousAssessmentId exists)
  scoreDelta: ScoreDeltaSummary | null;

  // Recommendation progress (D-05, D-06)
  recommendationSummary: RecommendationSummary;

  // Milestone engagement (conditional, requires actionPlanPublishedAt)
  engagementSummary: EngagementSummary | null;

  // Top open priorities (D-05)
  topPriorities: TopPriorityItem[];

  // Intelligence timeline excerpt (conditional)
  intelligenceExcerpt: IntelligenceEvent[];

  // Next recommended steps (D-05)
  nextSteps: string[];

  // Advisor-authored overlay (frozen at publish, cleared in client variant)
  advisorNotes: string | null;
  meetingAgenda: string | null;
  discussionPrompts: string[];

  // Reporting window metadata
  assessmentIds: string[];        // all assessments in scope
  currentAssessmentId: string;    // most recent
  previousAssessmentId: string | null;  // for delta, if reassessment exists
}

export interface PillarReadiness {
  pillar: string;
  pillarLabel: string;  // human-readable from pillar catalog
  score: number;
  riskLevel: string;    // from PillarScore.riskLevel
  impactLevel: "Critical" | "High" | "Medium" | "Low";  // D-27
}

export interface ScoreDeltaSummary {
  deltas: PillarDelta[];  // reuse existing PillarDelta type from reassessment-types.ts
  overallDirection: "improved" | "regressed" | "mixed" | "unchanged";
  keyDrivers: string[];   // top 3-5 attribution items across all pillars
}

export interface RecommendationSummary {
  total: number;
  completed: number;
  inProgress: number;
  deferred: number;
  open: number;
  completionPct: number;  // completed / (total - deferred)
}

export interface EngagementSummary {
  milestoneCompletionPct: number;
  totalMilestones: number;
  completedMilestones: number;
  overdueMilestones: number;
}

export interface TopPriorityItem {
  name: string;
  category: string;
  impactLevel: "Critical" | "High" | "Medium" | "Low";
  status: string;
}

export interface IntelligenceEvent {
  action: string;
  label: string;
  occurredAt: string;  // ISO date
}
```

### Pattern 2: Executive Readiness Tier Derivation (Claude's Discretion)

**What:** Map per-pillar scores to a headline readiness tier without a false composite.

```typescript
// Proposed algorithm -- Claude's Discretion
function deriveExecutiveReadiness(pillars: PillarReadiness[]): ExecutiveReadinessTier {
  const criticalCount = pillars.filter(p => p.riskLevel === "CRITICAL").length;
  const highCount = pillars.filter(p => p.riskLevel === "HIGH").length;
  const lowCount = pillars.filter(p => p.riskLevel === "LOW").length;

  if (criticalCount > 0 || highCount >= 2) return "Developing";
  if (lowCount >= Math.ceil(pillars.length * 0.6)) return "Advanced";
  return "Mature";
}
```

### Pattern 3: Impact Level Derivation (Claude's Discretion)

**What:** Map recommendation metadata to Critical/High/Medium/Low impact level.

```typescript
// urgencyScore from AssessmentRecommendation is the primary signal
function deriveImpactLevel(
  urgencyScore: number,   // 1-10
  pillarWeight: number,   // from PILLAR_WEIGHTS map
): "Critical" | "High" | "Medium" | "Low" {
  const composite = urgencyScore * (pillarWeight / 16);  // 16 = max pillar weight
  if (composite >= 7) return "Critical";
  if (composite >= 5) return "High";
  if (composite >= 3) return "Medium";
  return "Low";
}
```

### Pattern 4: Native PDF Progress Bar (D-14)

**What:** react-pdf View primitives for visual indicators -- no chart libraries.

```typescript
// Source: existing RiskHeatMap.tsx and styles.ts patterns -- [ASSUMED]
function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <View style={{ height: 8, backgroundColor: "#e5e7eb", borderRadius: 4 }}>
      <View
        style={{
          width: `${pct}%`,
          height: "100%",
          backgroundColor: color,
          borderRadius: 4,
        }}
      />
    </View>
  );
}

// Sparkline via stacked vertical bars (react-pdf supports flexDirection row)
function SparklineBar({ height, color }: { height: number; color: string }) {
  return (
    <View style={{ width: 6, height, backgroundColor: color, marginRight: 2 }} />
  );
}
```

### Pattern 5: Cron Auth Pattern (reuse existing)

```typescript
// All cron routes use CRON_SECRET Bearer token auth -- from review-cadence/route.ts [VERIFIED: codebase]
const providedSecret = authHeader.substring(7);
const providedBuf = Buffer.from(providedSecret, "utf8");
const expectedBuf = Buffer.from(process.env.CRON_SECRET!, "utf8");
if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
  return NextResponse.json({ error: "Invalid cron secret" }, { status: 401 });
}
```

### Anti-Patterns to Avoid

- **Composite score as a number:** D-09 prohibits a mathematical composite. Use Executive Readiness tier (string).
- **Empty pages for conditional sections:** D-07 requires zero-state text. Always render the section header with forward-looking text.
- **Client-facing advisor notes:** D-17 prohibits advisor-internal language in the Executive Report. Strip `advisorNotes`/`meetingAgenda`/`discussionPrompts` from the client variant before calling `renderToBuffer`.
- **Auto-distributing scheduled drafts:** D-21 requires all scheduled reports to remain DRAFT until advisor explicitly publishes.
- **SVG/canvas-based charts:** D-14 prohibits server-side chart rendering. Use react-pdf View primitives.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Score delta computation | Custom delta math | `computePillarDeltas` in `analytics/score-delta.ts` | Already handles direction thresholds, attribution, and "No new planning activity" fallback |
| Recommendation aggregation | Custom query | `getGuidancePackageForClient` in `recommendations/guidance-package.ts` | Handles deduplication across assessments, overlay composition |
| Engagement metrics | Custom milestone query | `getEngagementMetrics` / `getEngagementClients` in `engagement/engagement-metrics.ts` | Handles stalled detection, overdue counting, per-client breakdown |
| Multi-assessment trend data | Custom Prisma query | `getFamilyGovernanceTrends` in `analytics/queries.ts` | Ordered assessment history with weighted scores |
| Branding resolution | Custom fetch | `getAdvisorBrandingForPDF` / `buildBrandingSnapshot` | Handles subscription gating, legacy fallback |
| Cron auth | Custom token check | `timingSafeEqual` pattern from `review-cadence/route.ts` | Timing-safe comparison, already audited |
| PDF metadata | Custom object | `createBrandedPDFMetadata` in `branding-integration.ts` | Consistent branded author/creator fields |

---

## Key Types / Interfaces Needing Extension

### New: `ExecutiveReport` Prisma Model
The existing `Report` model is scoped to single-assessment reports (`snapshotData` is `ReportSnapshot`). A separate model avoids type confusion and allows independent migration.

Required fields (mirror `Report` closely):
```
id, clientId, advisorProfileId, status (DRAFT/PUBLISHED/SUPERSEDED),
version, reportingPeriodStart, reportingPeriodEnd,
executiveSnapshotData Json?, brandingSnapshot Json?,
publishedAt, publishedById, createdAt, updatedAt
```

### Extend: `ReportStatus` enum
Already has `DRAFT | PUBLISHED | SUPERSEDED` -- reuse for ExecutiveReport.

### New: `ExecutiveReportSnapshot` TypeScript interface
See Pattern 1 above. Lives in `src/lib/pdf/executive-report-types.ts`.

### Reuse unchanged
- `PillarDelta` from `src/lib/assessment/reassessment-types.ts`
- `AdvisorBrandingData` from `src/lib/validation/branding`
- `GuidancePackageSummary` from `src/lib/recommendations/types`
- `EngagementMetrics` from `src/lib/engagement/engagement-metrics.ts`
- `ReportStatus` enum from Prisma (or reuse the same DB enum)

---

## Common Pitfalls

### Pitfall 1: Snapshot Assembly N+1 Queries
**What goes wrong:** Assembling multi-assessment data with per-assessment DB calls inside a loop.
**Why it happens:** The builder joins data from 5+ models; naive implementation issues one query per assessment.
**How to avoid:** Batch all assessment IDs up front. `getGuidancePackageForClient` already uses `{ in: assessmentIds }`. Follow the same pattern in `buildExecutiveReportSnapshot`.
**Warning signs:** Slow response on clients with 3+ assessments; use Prisma query logging in dev.

### Pitfall 2: Advisor Notes Leaking into Client PDF
**What goes wrong:** `advisorNotes` / `discussionPrompts` from the snapshot appear in the Executive Report rendered for the client.
**Why it happens:** Both variants render from the same snapshot; it's easy to include all fields.
**How to avoid:** The render function takes a `variant: 'client' | 'advisor'` param. The `ExecutiveReport` Document conditionally omits advisor-only pages based on variant. Never derive this from a flag in the snapshot itself (the snapshot is immutable; the variant is a render-time choice).

### Pitfall 3: Stale Reporting Period on Republish
**What goes wrong:** If the reporting period is derived at render time rather than frozen in the snapshot, a republished report would silently change its period window.
**Why it happens:** `reportingPeriodStart`/`reportingPeriodEnd` are stored as snapshot fields but recalculated on DRAFT previews.
**How to avoid:** Store `reportingPeriod` in the snapshot at generation time. DRAFT previews show a "period calculated at preview time" note. Publish freezes the period in `executiveSnapshotData`.

### Pitfall 4: Zero-State Pages Not Rendering
**What goes wrong:** A conditional section (e.g., Score Delta) is skipped when data is absent, leaving an inconsistent page count between clients.
**Why it happens:** Conditional rendering without D-07 compliance.
**How to avoid:** Every conditional section has a zero-state component that renders the section header + 2-sentence forward-looking text. Always render the section; use a `hasData` prop to choose between data view and zero-state.

### Pitfall 5: ReviewCadence Cron Double-Draft
**What goes wrong:** The cron runs twice due to Vercel retry; creates two DRAFT ExecutiveReport rows for the same client/period.
**Why it happens:** Cron jobs can retry on timeout.
**How to avoid:** Check for an existing DRAFT row for the same `(clientId, reportingPeriodStart, reportingPeriodEnd)` before creating a new one. Idempotent upsert or unique constraint on `(clientId, version)`.

### Pitfall 6: `react-pdf` Width Percentage in Nested Views
**What goes wrong:** Percentage widths (e.g., `width: "100%"`) fail in deeply nested flex containers in react-pdf.
**Why it happens:** react-pdf uses yoga layout; percentage widths resolve against parent flex container, not page width.
**How to avoid:** Use explicit numeric widths derived from page dimensions (A4 = 595pt wide, minus 72pt padding each side = 451pt content width). Already established in `RiskHeatMap.tsx` with `"31.5%"` cell widths. Test column layouts early.

---

## Code Examples

### Snapshot builder entry point pattern [VERIFIED: codebase]
```typescript
// src/lib/pdf/build-executive-snapshot.ts
export async function buildExecutiveReportSnapshot(
  clientId: string,
  advisorProfileId: string,
  options: {
    periodStart?: Date;
    periodEnd?: Date;
  } = {}
): Promise<ExecutiveReportSnapshot> {
  const end = options.periodEnd ?? new Date();
  // ... batch all queries in parallel with Promise.all
  const [assessments, guidancePackage, engagementMetrics, cadence] =
    await Promise.all([
      prisma.assessment.findMany({ where: { userId: clientId, status: "COMPLETED", completedAt: { lte: end } }, include: { scores: true }, orderBy: { completedAt: "asc" } }),
      getGuidancePackageForClient(clientId, advisorProfileId),
      getEngagementMetrics(advisorProfileId),  // scoped to this client via advisorProfileId
      prisma.reviewCadence.findFirst({ where: { clientId, advisorProfileId } }),
    ]);
  // ... assemble and return snapshot
}
```

### Two-variant render pattern [ASSUMED: design derived from codebase patterns]
```typescript
// src/lib/pdf/render-executive-report.tsx
export async function renderExecutiveReportPdf(input: {
  snapshot: ExecutiveReportSnapshot;
  branding: AdvisorBrandingData | null;
  variant: 'client' | 'advisor';
  draft: boolean;
}): Promise<{ bytes: Uint8Array; filenameSlug: string }> {
  const bytes = await renderToBuffer(
    <ExecutiveReportDocument
      snapshot={input.snapshot}
      branding={input.branding}
      variant={input.variant}
      draft={input.draft}
    />
  );
  return { bytes: bytes as unknown as Uint8Array, filenameSlug: "..." };
}
```

### Delta section conditional render [ASSUMED: design derived from codebase patterns]
```typescript
// Inside ExecutiveReportDocument
{snapshot.scoreDelta !== null ? (
  <ScoreDeltaPage deltas={snapshot.scoreDelta.deltas} draft={draft} />
) : (
  <ScoreDeltaZeroStatePage draft={draft} />
)}
```

---

## Runtime State Inventory

Not applicable. This is a greenfield phase (new models, new routes, new components).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@react-pdf/renderer` | PDF generation | Yes | ^4.3.2 | — |
| `CRON_SECRET` env var | Scheduled drafts | Assumed set | — | Cron route returns 500 if missing (existing behavior) |
| PostgreSQL | ExecutiveReport model | Yes | Neon (project-wide) | — |

No blocking missing dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map

| Capability | Test Type | Automated Command | Notes |
|-----------|-----------|-------------------|-------|
| `buildExecutiveReportSnapshot` assembler | unit | `npm run test -- build-executive-snapshot` | Test period boundary, zero-state (no assessments), delta present/absent branches |
| `computePillarDeltas` integration | unit | Existing tests in `score-delta.test.ts` | Already covered; verify import chain works |
| `deriveExecutiveReadiness` tier | unit | `npm run test -- executive-report-types` | Pure function; test all tier boundary conditions |
| `deriveImpactLevel` | unit | `npm run test -- executive-report-types` | Pure function; test score/weight combos |
| Advisor notes excluded from client variant | unit | test render variant prop | Assert `advisorNotes` page absent in 'client' variant |
| Cron idempotency | unit | test cron route handler | Mock Prisma; verify no duplicate DRAFT creation |

### Wave 0 Gaps
- [ ] `src/lib/pdf/executive-report-types.test.ts` -- covers tier derivation, impact level, snapshot schema validation
- [ ] `src/lib/pdf/build-executive-snapshot.test.ts` -- covers assembler with mocked Prisma
- [ ] Prisma migration for `ExecutiveReport` model

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Advisor-to-client assignment check before snapshot assembly (`clientAdvisorAssignment` with `status: "ACTIVE"`) -- same pattern as existing reports |
| V5 Input Validation | yes | Zod on server action inputs (date range, clientId, reportId params) |
| V4 Access Control (client) | yes | Clients must not access DRAFT executive reports -- enforce in PDF route (same as Report model) |
| V4 Access Control (advisor brief) | yes | Advisor Brief PDF route restricted to ADVISOR + ADMIN roles only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Advisor accesses another advisor's client data | Elevation of Privilege | `clientAdvisorAssignment` check scoped to requesting advisor's `advisorProfileId` |
| Client fetches Advisor Brief PDF | Information Disclosure | Route checks `session.user.role !== "USER"` before serving advisor variant |
| Cron endpoint called without secret | Spoofing | `timingSafeEqual(CRON_SECRET)` -- established pattern from `review-cadence/route.ts` |
| Date range manipulation to expose data outside advisor relationship window | Tampering | Advisor-client assignment is a JOIN requirement, not filtered by date alone |

---

## State of the Art

| Area | Current Approach | Phase 25 Approach |
|------|-----------------|-------------------|
| PDF rendering | `renderToBuffer(<AssessmentReport>)` | `renderToBuffer(<ExecutiveReportDocument>)` -- same pattern, new Document |
| Snapshot storage | `Report.snapshotData` (single assessment) | New `ExecutiveReport.executiveSnapshotData` (multi-assessment) |
| Charts in PDF | None (heat map uses View/Text only) | None (D-14: native primitives only) |
| Scheduled reports | No existing scheduled report drafts | New cron: `/api/cron/executive-report-drafts` triggers on ReviewCadence |
| Report variants | Single client-facing PDF | Two variants from one snapshot (client + advisor brief) |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Impact level derived from `urgencyScore` field on `AssessmentRecommendation` (not a separate field) | Pattern 3 | If urgencyScore is not reliably populated, fallback to `priority` field |
| A2 | Executive Readiness tier algorithm based on criticalCount/highCount/lowCount distribution | Pattern 2 | Tier thresholds may need tuning after advisor feedback -- keep pure function easy to adjust |
| A3 | Advisor Brief pages use same `executiveSnapshotData`; advisor commentary stored as overlay fields IN the snapshot | Snapshot Schema | If advisors want to edit the brief after publish, the current frozen-snapshot model requires a new DRAFT row |
| A4 | Cron runs for each ReviewCadence approaching nextDueDate (same trigger as review-cadence cron) | Cron pattern | If the ReviewCadence cron already processes all due cadences, the new cron can piggyback rather than re-query |

---

## Open Questions

1. **New `ExecutiveReport` model vs `reportType` field on existing `Report` model**
   - What we know: CONTEXT.md D-01 says "new ExecutiveReportSnapshot schema, separate"; D-03 says "reuse Draft/Published/Superseded lifecycle."
   - What's unclear: Whether to reuse the `Report` table with a discriminator or create a parallel `ExecutiveReport` table.
   - Recommendation: New `ExecutiveReport` model. The `Report.snapshotData` JSON shape assumes a single-assessment structure; a separate model avoids migration of the existing `Report` table and keeps concerns isolated.

2. **Where does the advisor enter `advisorNotes` and `meetingAgenda` for the Advisor Brief?**
   - What we know: D-18 says "advisor notes, meeting agenda, discussion prompts." D-21 says advisor reviews before publishing.
   - What's unclear: Is there an edit form before publishing, or can the advisor only add notes pre-generation?
   - Recommendation: Simple textarea inputs in the "Generate Executive Report" drawer (similar to the DRAFT editing UI on existing reports). Store in `ExecutiveReport.advisorNotes` (not in the snapshot until publish).

3. **`getEngagementMetrics` scopes to all advisor clients; Phase 25 needs per-client**
   - What we know: `getEngagementMetrics(advisorProfileId)` returns aggregate across ALL active clients.
   - What's unclear: There's no single-client engagement metrics function.
   - Recommendation: Use `getEngagementClients(advisorProfileId)` and filter by `clientId`, or extract a new `getEngagementMetricsForClient(clientId)` helper from the existing implementation.

---

## Sources

### Primary (HIGH confidence)
- Codebase: `src/lib/pdf/render-report.tsx` -- render pipeline verified
- Codebase: `src/lib/pdf/build-report-snapshot.ts` -- snapshot builder pattern verified
- Codebase: `src/lib/analytics/score-delta.ts` -- `computePillarDeltas` signature verified
- Codebase: `src/lib/recommendations/guidance-package.ts` -- `getGuidancePackageForClient` verified
- Codebase: `src/lib/engagement/engagement-metrics.ts` -- `getEngagementMetrics` signature verified
- Codebase: `src/lib/analytics/queries.ts` -- `getFamilyGovernanceTrends` verified
- Codebase: `prisma/schema.prisma` -- `Assessment.previousAssessmentId`, `ReviewCadence`, `Report`, `SolutionActivity` models verified
- Codebase: `src/app/api/cron/review-cadence/route.ts` -- cron auth pattern verified
- Codebase: `package.json` -- `@react-pdf/renderer ^4.3.2` verified
- Codebase: `.planning/phases/25-executive-reporting/25-CONTEXT.md` -- locked decisions

### Secondary (MEDIUM confidence)
- react-pdf docs [ASSUMED]: `Svg` primitive available in @react-pdf/renderer v4 for potential sparkline drawing; verified by absence of SVG usage in existing components (team chose View-based approach throughout)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already in project
- Architecture: HIGH -- pattern directly mirrors existing report pipeline
- Data sources: HIGH -- all Prisma queries verified in existing modules
- PDF primitives for visualization: HIGH -- existing RiskHeatMap.tsx confirms View-based approach works
- Snapshot schema design: MEDIUM -- Claude's Discretion; exact field layout not user-specified

**Research date:** 2026-06-27
**Valid until:** 2026-07-28 (stable stack; 30 days)
