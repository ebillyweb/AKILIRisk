---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: milestone
status: ready
last_updated: "2026-06-28T04:00:00.000Z"
progress:
  total_phases: 7
  completed_phases: 6
  total_plans: 21
  completed_plans: 21
  percent: 100
---

# Project State

## Project Reference

**Core Value:** Prevent family wealth from becoming family conflict through systematic risk assessment and actionable governance recommendations

**Current Focus:** v1.5 Cyber Risk Intelligence — Expand beyond family governance into comprehensive family risk intelligence by adding cyber risk as distinct pillar with unified risk profiling

## Current Position

**Milestone:** v1.5 Cyber Risk Intelligence
**Phase:** 25 - Executive Reporting (DONE)
**Plan:** 3 of 3 (complete)
**Status:** Phase complete -- verified and approved

### Phase 25 Goal

Generate executive-grade reports that tell the full risk reduction story -- not just scores, but a strategic business review spanning multiple assessments, risk domains, recommendation progress, score deltas with attribution, and next steps. Two output types: Executive Report (client-facing) and Advisor Brief (internal meeting prep).

**Requirements:** REPORT-01

## Performance Metrics

### Milestone Progress

- **Phases:** 6/7 complete (Phases 19, 20, 21, 22, 24, 25)
- **Requirements:** 9 core + 4 lifecycle (LIFECYCLE-01 through 03, REPORT-01), 2 completed (UNIFIED-01, UNIFIED-02)
- **Coverage:** 100% (all requirements mapped)

### Development Velocity

- **Started:** 2026-03-18 (roadmap creation)

### Historical Velocity

**Previous milestones:**

- v1.0 (4 phases): 22 days
- v1.1 (3 phases): 1 day
- v1.2 (3 phases): 1 day
- v1.3 (4 phases): 26 days
- v1.4 (4 phases): 4 days

**Technical Health:**

- Codebase: ~2.5M lines TypeScript/TSX (comprehensive platform)
- Architecture: Next.js 15, Prisma 7, PostgreSQL, Auth.js v5, TanStack Query & React Table, Recharts
- Security: TOTP MFA, Argon2id password hashing, AES-256-GCM encryption, rate limiting, row-level data isolation
- Assessment Coverage: 68 questions with household-aware personalization and advisor customization

## Accumulated Context

### Key Decisions

- **Domain Separation Strategy:** Cyber risk implemented as parallel pillar to governance, maintaining strict boundaries while enabling unified views
- **Security Architecture:** Multi-tenant cyber risk data uses same row-level security as existing governance system
- **Performance Model:** Async processing with cached results, avoiding blocking workflows on external APIs
- **Scoring Consistency:** Cyber risk reuses proven calculatePillarScore engine for mathematical reliability and consistency with governance assessment
- **Weight Distribution:** Banking Security sub-category weighted 4 (vs 3 for others) to emphasize financial risk evaluation focus
- **AI recommendation caching in missingControls JSON field for performance**
- **gpt-4o-mini model selection for cost-effective structured output**
- **Identity Risk Subcategory Weighting:** Social Exposure and Public Information weighted 4 (vs 3 for Digital Footprint and Family Visibility) reflecting primary identity theft vectors
- **Identity Risk Question Bank Size:** 21 questions providing comprehensive coverage while maintaining assessment efficiency and user experience
- **Phase 21-01: Dual registration pattern:** New pillar rules added to both setup-all-pillar-rules.ts (DB seed) AND recommendation-catalog-fixtures.ts (test mocks) -- both must stay in sync
- **Phase 21-01: New pillar service categories:** financial (liquidity, tax), legal (estate), advisory (behavioral) -- distinct from existing governance/security/insurance/reputation
- **Phase 21-02: rulesOverride backward-compatibility:** resolveRecommendationRulesForAssessment returns undefined when no snapshot -- engine falls back to DB load, zero behavior change for existing assessments
- **Phase 21-02: CatalogRule->RecommendationRule mapping required:** must map serviceRecommendationId->serviceId and triggerConditions->conditions before passing as rulesOverride to engine
- **Phase 24-01: Assessment version = chain length:** Assessment.version is a rescore counter; reassessment version is derived from walking the previousAssessmentId chain
- **Phase 24-01: SolutionActivity FK nullable evolution:** assessmentRecommendationId made nullable via ALTER COLUMN DROP NOT NULL; new assessmentId FK added for assessment-scoped events
- **Phase 25-01: ExecutiveReport as separate model:** New ExecutiveReport table, not a reportType discriminator on existing Report. ExecutiveReportSnapshot is independent from ReportSnapshot. Shared PDF infrastructure (branding, rendering, styles).
- **Phase 25-01: Executive Readiness tier replaces composite score:** Developing/Mature/Advanced derived from per-pillar risk levels. No mathematical composite score (D-09).
- **Phase 25-01: Qualitative impact levels:** Critical/High/Medium/Low derived from urgency * pillarWeight. Financial dollar amounts deferred to future phases.

### Architecture Approach

- **Foundation:** Builds on proven v1.4 platform patterns (Next.js/Prisma/PostgreSQL)
- **Data Model:** Separate schemas for cyber-specific data, materialized views for unified scoring
- **Integration:** Leverages ae-cvss-calculator for CVSS 4.0 scoring, mathjs for composite risk calculations
- **Reporting:** ExecutiveReport model with Draft/Published/Superseded lifecycle and snapshot immutability. Two render variants (client + advisor brief) from one snapshot.

### Phase Dependencies

1. Phase 19: No dependencies (builds on v1.4 foundation)
2. Phase 20: Requires Phase 19 cyber risk foundation
3. Phase 21: Requires Phase 20 identity assessment complete
4. Phase 22: Requires Phase 21 recommendation engine complete
5. Phase 23: Requires Phase 22 recommendation experience complete (opt-in layer)
6. Phase 24: Requires Phase 23 execution tracking complete
7. Phase 25: Requires Phase 24 continuous improvement complete

## Active TODOs

### Remaining

- [ ] Phase 23 - Optional Client Engagement & Implementation Tracking (Planned, 0/5)

### Phase 25 Complete

- [x] REPORT-01: Executive-grade reports with risk reduction narrative, score deltas, recommendation progress, and trends

### Phase 24 Complete

- [x] LIFECYCLE-03: Reassessment, score deltas, risk intelligence timeline

### Phase 21 Complete

- [x] UNIFIED-01: All 10 pillars have platform recommendation rules
- [x] UNIFIED-02: Advisor customizations honored via rulesOverride

### Phase 19 Complete

- [x] CYBER-01: Independent cyber risk assessment with numerical scoring
- [x] CYBER-02: Automated cyber risk recommendations based on assessment results

## Known Blockers

None identified.

## Session Continuity

**Last Action:** Phase 25 complete -- all 3 plans executed, verified, approved.
**Next Action:** Phase 23 (Client Engagement & Implementation Tracking) is the only remaining phase in v1.5.

---
*State updated: 2026-06-28*
*Phase 25 complete: 3/3 plans, verified*
*Next phase: 23*
