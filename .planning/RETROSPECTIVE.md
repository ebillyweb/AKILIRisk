# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.5 -- Cyber Risk Intelligence

**Shipped:** 2026-06-28
**Phases:** 7 | **Plans:** 26
**Commits:** 573 | **Timeline:** 102 days

### What Was Built
- 10-pillar risk assessment platform (added cyber + identity pillars to existing governance)
- AI-powered recommendation engine with three-tier override policy (platform/enterprise/advisor)
- Full recommendation lifecycle: generation -> advisor review -> client action plan -> implementation tracking -> reassessment
- Executive reporting pipeline with branded 8-section PDF, draft/publish workflow, and scheduled cron generation
- Continuous risk improvement: chained reassessments, score deltas, review cadence engine
- Opt-in implementation tracking with milestone management, activity feed, and engagement dashboard

### What Worked
- Wave-based parallel execution kept phases moving efficiently despite 26 plans
- Strict domain separation (cyber as parallel pillar) prevented data model contamination
- Reusing proven patterns (calculatePillarScore, report branding, server actions) across new pillars accelerated delivery
- Phase dependency chain (19->20->21->22->23->24->25) created a natural build-up that reduced integration risk
- Pattern-mapping before planning consistently identified the right analog files

### What Was Inefficient
- ROADMAP tracking fell behind (Phase 23 was fully executed but showed 0/5 in progress table)
- Some test files became stale when later phases extended shared modules (Phase 24 broke Phase 23 activity-feed tests)
- REQUIREMENTS.md checkboxes not updated as phases completed -- had to bulk-update at milestone close

### Patterns Established
- Three-tier recommendation override: platform canonical, enterprise/advisor composed at read time, rules cloned at write for snapshot integrity
- Append-only activity architecture: SolutionActivity as universal audit trail across all lifecycle events
- Feature flag gating pattern: enterprise toggle + advisor opt-in + zero-noise default for non-adopters
- Executive Readiness tiers (Developing/Mature/Advanced) as qualitative alternative to composite scores
- Native react-pdf primitives only (View/Text) for PDF visualizations -- no SVG or chart libraries

### Key Lessons
1. Keep ROADMAP progress table and REQUIREMENTS checkboxes updated as each phase completes, not at milestone close
2. When extending shared modules across phases, update the earlier phase's tests in the same commit
3. Pattern-mapping before planning is high-value -- consistently identifies the right files and reduces planning time

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Change |
|-----------|--------|-------|------------|
| v1.5 | 7 | 26 | Wave-based parallel execution, pattern-mapping, full lifecycle delivery |

### Top Lessons (Verified Across Milestones)

1. Reusing proven scoring and branding patterns across new pillars accelerates delivery without sacrificing quality
2. Domain separation (parallel pillars, not merged models) prevents contamination and simplifies reasoning
3. Feature flag gating is essential for opt-in features -- zero-noise for non-adopters
