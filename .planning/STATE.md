---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: milestone
status: ready
last_updated: "2026-06-27T06:15:00.000Z"
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 14
  completed_plans: 8
  percent: 43
---

# Project State

## Project Reference

**Core Value:** Prevent family wealth from becoming family conflict through systematic risk assessment and actionable governance recommendations

**Current Focus:** v1.5 Cyber Risk Intelligence — Expand beyond family governance into comprehensive family risk intelligence by adding cyber risk as distinct pillar with unified risk profiling

## Current Position

**Milestone:** v1.5 Cyber Risk Intelligence
**Phase:** 22 - Recommendation Experience (PLANNED)
**Plan:** 0 of 6 (ready to execute)
**Status:** Ready to execute — 6 plans in 3 waves

### Phase 21 Goal

Every one of the ten risk pillars independently generates platform recommendations, advisor customizations are honored, and the recommendation engine produces a fully prioritized recommendation set for every completed assessment.

**Requirements:** UNIFIED-01, UNIFIED-02

## Performance Metrics

### Milestone Progress

- **Phases:** 3/7 complete (Phases 19, 20, 21)
- **Requirements:** 9 core + 4 lifecycle (LIFECYCLE-01 through 03, REPORT-01), 2 completed (UNIFIED-01, UNIFIED-02)
- **Coverage:** 100% (all requirements mapped)

### Development Velocity

- **Started:** 2026-03-18 (roadmap creation)
- **Current:** Day 1
- **Estimated:** TBD (needs planning)

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
- **Phase 21-01: Dual registration pattern:** New pillar rules added to both setup-all-pillar-rules.ts (DB seed) AND recommendation-catalog-fixtures.ts (test mocks) — both must stay in sync
- **Phase 21-01: New pillar service categories:** financial (liquidity, tax), legal (estate), advisory (behavioral) — distinct from existing governance/security/insurance/reputation
- **Phase 21-02: rulesOverride backward-compatibility:** resolveRecommendationRulesForAssessment returns undefined when no snapshot — engine falls back to DB load, zero behavior change for existing assessments
- **Phase 21-02: CatalogRule->RecommendationRule mapping required:** must map serviceRecommendationId->serviceId and triggerConditions->conditions before passing as rulesOverride to engine

### Architecture Approach

- **Foundation:** Builds on proven v1.4 platform patterns (Next.js/Prisma/PostgreSQL)
- **Data Model:** Separate schemas for cyber-specific data, materialized views for unified scoring
- **Integration:** Leverages ae-cvss-calculator for CVSS 4.0 scoring, mathjs for composite risk calculations

### Phase Dependencies

1. Phase 19: No dependencies (builds on v1.4 foundation)
2. Phase 20: Requires Phase 19 cyber risk foundation
3. Phase 21: Requires Phase 20 identity assessment complete
4. Phase 22: Requires Phase 21 recommendation engine complete
5. Phase 23: Requires Phase 22 recommendation experience complete (opt-in layer)
6. Phase 24: Requires Phase 23 execution tracking complete
7. Phase 25: Requires Phase 24 continuous improvement complete

### Research Insights

- **Foundation Strategy:** Must establish domain boundaries and data architecture before any implementation to prevent contamination
- **External Integration Isolation:** Threat intelligence APIs require proper caching and tenant isolation to prevent security cascades
- **Unified Scoring Mathematics:** Risk aggregation requires mature individual assessment systems to ensure mathematical validity
- **User Experience Separation:** Maintain separate assessment flows, use unified dashboards for combined results only

## Active TODOs

### Immediate

- [x] Plan Phase 22 - Recommendation Experience

### Upcoming

- [ ] Execute Phase 22
- [ ] Plan Phase 23 - Optional Client Engagement & Implementation Tracking
- [ ] Plan Phase 24 - Continuous Risk Improvement
- [ ] Plan Phase 25 - Executive Reporting

### Phase 21 Complete

- [x] UNIFIED-01: All 10 pillars have platform recommendation rules
- [x] UNIFIED-02: Advisor customizations honored via rulesOverride

### Phase 19 Complete

- [x] CYBER-01: Independent cyber risk assessment with numerical scoring ✅
- [x] CYBER-02: Automated cyber risk recommendations based on assessment results ✅
- [x] Advisor visibility: Client cyber risk scores in separate portal section ✅

## Known Blockers

None identified. Ready to proceed with Phase 19 planning.

## Research Flags

**Phase 20:** Complex vendor integrations require API security research and threat intelligence provider evaluation during planning
**Phase 22:** Recommendation UX across advisor/enterprise/client roles — requires mapping existing UI touchpoints before planning
**Phase 24:** Reassessment versioning and score delta computation need schema design research
**Phase 25:** Executive reporting with trend visualization needs domain-specific research

**Phases 19, 21:** Follow established patterns, skip research-phase

## Session Continuity

**Last Action:** Phase 22 planned -- 6 plans in 3 waves (schema+engine, lifecycle+actions, 3 UI surfaces). Verification passed iteration 2.
**Next Action:** Execute Phase 22 (Recommendation Experience)

**Context Preservation:** Phases 19-21 complete. Phase 21: 10-pillar recommendation coverage achieved. Post-phase: built Risk Solutions Library -- compose-at-read layered system (EnterpriseSolutionCustomization, AdvisorSolutionCustomization, SolutionMilestone, SolutionActivity), lifecycle state machine, milestone hydration on ACCEPTED, sourceLayerSummary persistence. Phase 22 context gathered: Strategic Action Plan (renamed from Family Roadmap), per-client holistic Guidance Package (cumulative across assessments), generic Platform Asset Catalog inheritance engine (recommendations first consumer), three-tier override policy (Protected/Configurable/Additions), implementation-focused lifecycle (Generated->Reviewed->Included->InProgress->Completed), Defer = "not now" with trigger events, shared ownership (task status + validation status), Role vs Assignee separation.

---
*State updated: 2026-06-25*
*Stopped at: Roadmap restructured, ready to plan Phase 22*
