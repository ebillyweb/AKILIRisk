# Roadmap: v1.5 Cyber Risk Intelligence

**Goal:** Expand beyond family governance into comprehensive family risk intelligence by adding cyber risk as a distinct, independently-scored pillar that feeds into a unified risk profile — then close the full lifecycle loop from assessment through implementation to measurable risk reduction.

**Phases:** 7
**Depth:** Quick
**Coverage:** 9/9 requirements mapped + 5 lifecycle phases added

## Overview

Builds cyber risk assessment capabilities as parallel pillar alongside existing governance system. Maintains strict domain separation while enabling unified family risk profiles that give advisors holistic visibility into both governance and cyber security posture. Phases 22-26 transform the platform from "here is your risk score" into a full lifecycle: Assessment, Recommendations, Implementation, Reassessment, Reporting.

## Phase Structure

### Phase 19: Cyber Risk Foundation

**Dependencies:** None (builds on existing v1.4 platform)
**Requirements:** CYBER-01, CYBER-02, FINANCE-01, FINANCE-02
**Plans:** 3 plans

**Goal:** Establish independent cyber risk assessment with financial security evaluation

Plans:

- [ ] 19-01-PLAN.md -- Cyber risk question bank, types, and scoring wrapper
- [ ] 19-02-PLAN.md -- Multi-pillar assessment UI, question flow, and scoring API
- [ ] 19-03-PLAN.md -- AI recommendations engine and advisor cyber risk dashboard

**Success Criteria:**

1. Family can complete cyber risk assessment with numerical scoring (0-10 scale matching governance)
2. System generates automated cyber risk recommendations based on assessment results
3. Advisor can view client cyber risk scores in separate portal section
4. Assessment evaluates banking security practices and payment method risks with actionable feedback

### Phase 20: Identity Risk Intelligence

**Dependencies:** Phase 19 (cyber risk foundation)
**Requirements:** IDENTITY-01, IDENTITY-02
**Plans:** 3 plans

**Goal:** Enable comprehensive identity exposure monitoring and analysis

Plans:

- [ ] 20-01-PLAN.md -- Identity risk question bank, types, and scoring wrapper
- [ ] 20-02-PLAN.md -- Assessment UI integration for identity risk pillar
- [ ] 20-03-PLAN.md -- AI recommendations engine and advisor identity risk dashboard

**Success Criteria:**

1. System analyzes family member social media exposure and assigns risk scores
2. Family receives public information visibility assessment with privacy recommendations
3. Advisor dashboard displays identity risk metrics alongside existing governance analytics
4. Platform identifies specific identity exposure gaps and generates remediation steps

### Phase 21: Platform Recommendation Engine

**Dependencies:** Phase 20 (identity assessment complete)
**Requirements:** UNIFIED-01, UNIFIED-02
**Plans:** 2 plans

**Goal:** Every one of the ten risk pillars independently generates platform recommendations, advisor customizations are honored, and the recommendation engine produces a fully prioritized recommendation set for every completed assessment.

Plans:

- [x] 21-01-PLAN.md -- Add recommendation rules and services for 4 missing pillars (liquidity, tax, estate, behavioral)
- [x] 21-02-PLAN.md -- Wire advisor rulesOverride into submission route and extend 10-pillar test coverage

**Success Criteria:**

1. All 10 pillars have platform recommendation rules in the DB
2. RecommendationEngine generates pillar-specific recommendations triggered by score thresholds, risk levels, and answer conditions for each pillar
3. AdvisorRecommendationRule overrides are applied when generating recommendations for an advisor's clients
4. Assessment submission produces a fully prioritized, deduplicated recommendation set across all assessed pillars
5. Existing governance recommendation rules continue to work unchanged

### Phase 22: Recommendation Experience

**Dependencies:** Phase 21 (recommendation engine complete)
**Requirements:** LIFECYCLE-01
**Plans:** 6 plans

**Goal:** Clients leave the assessment knowing exactly what to do next. Advisors can review, customize, and prioritize recommendations. Enterprises can layer their own playbooks and preferred vendors.

Plans:

- [x] 22-01-PLAN.md -- Schema evolution, asset catalog inheritance engine, override policy
- [x] 22-02-PLAN.md -- Lifecycle state machine extension, per-client guidance package aggregation
- [x] 22-03-PLAN.md -- Server actions for advisor guidance, enterprise overlays, client action plan
- [x] 22-04-PLAN.md -- Advisor Guidance Review UI
- [x] 22-05-PLAN.md -- Enterprise Guidance Customization UI
- [x] 22-06-PLAN.md -- Client Strategic Action Plan UI

**Advisor Experience:**

- Recommendation review queue with accept/decline workflow
- Decline reasons and advisor notes capture
- Recommendation prioritization and bulk actions
- Composed recommendation preview (platform + enterprise + advisor layers)

**Enterprise Experience:**

- Enterprise solution customization CRUD (cost, timeframe, provider overrides)
- Custom playbook steps and internal resources
- Preferred vendor management
- Preview of final composed recommendation

**Client Experience:**

- Personalized Action Plan page with accepted recommendations
- Milestone checklist with status indicators
- Timeline view of implementation steps
- Progress percentage per recommendation
- Estimated impact display

**Success Criteria:**

1. Advisor can review, accept, or decline each recommendation with notes
2. Enterprise admins can create solution overlays (cost/timeframe/provider/playbook)
3. Composed recommendation preview shows all three layers clearly attributed
4. Client sees a personalized action plan with milestones after advisor accepts
5. Each recommendation shows estimated timeline and projected risk impact

### Phase 23: Optional Client Engagement & Implementation Tracking

**Dependencies:** Phase 22 (recommendation experience complete)
**Requirements:** LIFECYCLE-02
**Plans:** 5 plans

**Goal:** Advisors who want ongoing client engagement get a lightweight project-management layer. Advisors who don't can ignore it entirely — the platform works either way. This is opt-in infrastructure, not a mandatory workflow.

Plans:

- [ ] 23-01-PLAN.md -- Schema extension (BLOCKED/DEFERRED enum, feature flag, publish field, due dates) + lifecycle logic + Zod schemas
- [ ] 23-02-PLAN.md -- Feature flag helper, activity feed query, publish mechanism services
- [ ] 23-03-PLAN.md -- Server actions for milestone management and publish + engagement metrics aggregation
- [ ] 23-04-PLAN.md -- Client UI: activity feed, next step callout, milestone progress bars, StrategicActionPlan integration
- [ ] 23-05-PLAN.md -- Advisor UI: engagement dashboard page, portfolio engagement column, publish button, block/defer dialogs

**Design Philosophy:**

- No feature in this phase should be required to complete an assessment or deliver a report.
- Advisors choose their operating model: hand off a PDF and move on, or track implementation over months. The platform supports both without judgment.
- Enterprise admins can enable/disable implementation tracking per firm. Individual advisors can opt out even if their firm enables it.
- All UI defaults to the simplest path. Tracking surfaces only appear when explicitly activated.

**Milestones (opt-in per recommendation):**

- Status tracking: Not Started, In Progress, Completed, Blocked, Deferred, Skipped
- Advisor can advance, block, or defer milestones
- Client can mark milestones complete (if advisor enables client self-service)
- Auto-completion detection (all milestones done = recommendation complete)

**Activity Feed (appears when there is activity):**

- Timeline of advisor comments, milestone completions, uploads, reminders, approvals
- Think GitHub/Linear activity feed UX
- Append-only, queryable by recommendation or client
- Visible to both advisor and client (role-appropriate filtering)
- Zero-state is clean — no empty feed, no "nothing to show" clutter

**Dashboard (progressive disclosure):**

- Default view remains assessment results for advisors not using tracking
- When tracking is active: per-recommendation progress bars (e.g., "Cybersecurity Uplift -- 72% Complete")
- Next step callout with due date
- Engagement status summary

**Success Criteria:**

1. Advisor and client can update milestone status when tracking is enabled
2. Activity feed shows chronological history of all recommendation actions
3. Client dashboard shows progress bars per active recommendation
4. Engagement auto-completes when all milestones are done
5. Advisor portfolio shows aggregate client progress
6. An advisor who never touches implementation tracking experiences zero friction or UI noise from this phase

### Phase 24: Continuous Risk Improvement

**Dependencies:** Phase 23 (client engagement infrastructure available)
**Requirements:** LIFECYCLE-03
**Plans:** 4 plans

**Goal:** Close the assessment loop -- clients can reassess, see score deltas, and measure the impact of completed solutions. This is where the platform becomes sticky.

Plans:

- [ ] 24-01-PLAN.md -- Schema migration (assessment versioning, SolutionActivity evolution, ReviewCadence model) + types + reassessment creation + score delta + targeted follow-up
- [ ] 24-02-PLAN.md -- Intelligence event constants + cadence engine logic + system triggers + enterprise feature flag
- [ ] 24-03-PLAN.md -- Server actions (reassessment + cadence) + cron route + activity feed evolution
- [ ] 24-04-PLAN.md -- UI components (PillarDeltaPanel, ReassessmentDialog, IntelligenceTimeline, ReviewCadencePanel) + human verification

**Reassessment:**

- Retake full assessment or individual pillars
- Assessment versioning (previousAssessmentId link)
- Scheduled reassessment reminders
- Reminder engine (configurable cadence per advisor/enterprise)

**Impact Measurement:**

- Before/after pillar score comparison (e.g., Governance: 7.8 -> 4.1, down 47%)
- Recommendation effectiveness tracking (which solutions moved the needle)
- Completed vs remaining solutions summary
- Projected vs actual risk reduction

**Risk Intelligence Timeline:**

- Every meaningful event becomes part of a permanent, auditable timeline
- Assessment completions, advisor actions, milestone completions, reassessments, score changes
- Useful for: advisors, enterprises, compliance, insurers, legal discovery, board meetings

**Success Criteria:**

1. Client can retake full assessment or individual pillars
2. System links new assessment to previous and computes score deltas
3. Before/after comparison shows per-pillar risk improvement
4. Advisor can schedule reassessment reminders
5. Risk intelligence timeline renders chronological history of all risk events

### Phase 25: Executive Reporting

**Dependencies:** Phase 24 (continuous improvement complete)
**Requirements:** REPORT-01
**Plans:** 3 plans

**Goal:** Generate executive-grade reports that tell the full risk reduction story -- not just "your score is 7.2" but "risk reduced 38%, 14 of 18 recommendations completed, estimated financial exposure reduced, top remaining risks, upcoming milestones, trend over six months."

Plans:

- [x] 25-01-PLAN.md -- Schema migration (ExecutiveReport model), snapshot types, derivation functions, snapshot builder + tests
- [x] 25-02-PLAN.md -- PDF section components, executive styles, render function, API route
- [x] 25-03-PLAN.md -- Server actions, query helpers, advisor UI (list + edit), draft form, cron route

**Report Content:**

- Executive summary with risk reduction percentage
- Completed vs total recommendations
- Estimated financial exposure reduction
- Top remaining risks
- Upcoming milestones
- Advisor recommendations
- Six-month trend visualization
- Risk intelligence timeline excerpt

**Success Criteria:**

1. Advisor can generate reports combining scores, recommendations, progress, and trends
2. PDF reports include before/after score comparisons and recommendation effectiveness
3. Reports show risk domain interactions and compounding effects
4. Executive summary is board-presentation ready
5. Automated report generation maintains existing branded template system

## Progress Tracking

| Phase | Status | Plans | Completion |
|-------|--------|-------|------------|
| 19 - Cyber Foundation | Complete | 3/3 | ██████████ 100% |
| 20 - Identity Intelligence | Complete | 3/3 | ██████████ 100% |
| 21 - Recommendation Engine | Complete | 2/2 | ██████████ 100% |
| 22 - Recommendation Experience | Complete | 6/6 | ██████████ 100% |
| 23 - Client Engagement & Tracking | Planned | 0/5 | ░░░░░░░░░░ 0% |
| 24 - Continuous Risk Improvement | Complete | 4/4 | ██████████ 100% |
| 25 - Executive Reporting | Complete | 3/3 | ██████████ 100% |

**Overall:** █████████░ 86% (6/7 phases complete)

## Architecture Notes

**Domain Separation:** Cyber risk runs as parallel pillar to governance, preventing data model contamination while enabling unified views through materialized scoring.

**Security Isolation:** Multi-tenant cyber risk data maintains same row-level security as governance system, with separate schemas for cyber-specific data.

**Performance Strategy:** Async cyber risk processing with cached results, never blocking workflows on external threat intelligence APIs.

**Recommendation Layers:** Platform ServiceRecommendation is canonical. Enterprise and advisor overlays are composed at read time (not cloned). Rules use clone-at-write for snapshot integrity.

**Activity Architecture:** SolutionActivity is append-only. Risk Intelligence Timeline aggregates activities across assessments, recommendations, and milestones into a single chronological view per client.

---
*Roadmap created: 2026-03-19*
*Roadmap updated: 2026-06-28 -- Phase 25 planned: 3 plans in 3 waves*
*Next phase: 25*
