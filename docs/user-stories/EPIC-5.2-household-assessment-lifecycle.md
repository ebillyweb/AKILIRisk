# Epic 5.2 — Household Assessment Lifecycle

**BRD:** FR-2 through FR-6; business rules §3.1, §3.2, §3.4  
**Scope:** Intake interview → advisor review → six-pillar questionnaire → scoring & tiers → control gaps & recommendations → advisor report draft/publish  
**Client UI:** `/intake`, `/assessment`, `/assessment/results`, `/dashboard`  
**Advisor UI:** `/advisor/review/[id]`, `/advisor/pipeline/[clientId]/report`  
**Core modules:** `src/lib/intake/*`, `src/lib/assessment/*`, `src/lib/actions/advisor-actions.ts`, `src/lib/actions/report-actions.ts`, `src/app/api/assessment/[id]/score/route.ts`

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-10 | Complete intake interview | **Done** | Audio, transcription, submit gate |
| US-11 | Review and approve intake | **Partial** | Auto IN_REVIEW on open; waiver via invite + advisor action |
| US-12 | Start multi-pillar assessment | **Done** | Six-pillar hub; focus areas stored for scoring |
| US-13 | Answer on maturity scale | **Done** | 0–3 scale, visibility, branching, skip |
| US-14 | Save and resume progress | **Done** | Server-authoritative resume; orphan cleanup |
| US-15 | Score a completed pillar | **Partial** | **Story drift:** assessment `COMPLETED` only when all 6 pillars scored |
| US-16 | View resilience & risk tier | **Partial** | Dashboard heat map; some UI still shows legacy `/10` in places |
| US-17 | Surface control gaps | **Done** | Top 5, priority × severity |
| US-18 | Generate service recommendations | **Done** | Rule engine + real `evaluateProfileCondition` |
| US-19 | Draft report (advisor) | **Done** | Single draft, watermark, advisor notes |
| US-20 | Publish & download report | **Done** | Client blocked until published; audit on download |

---

## US-10 — Complete the Intake Interview (Client)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Per-question audio/typed save + transcription queue | `/api/intake/[id]/audio`, `/api/intake/[id]/transcribe`, intake interview UI |
| Incomplete → refuse submit | Submit validation in intake actions / complete page |
| All answered → `SUBMITTED` + notify advisors | Intake status update + notification on submit |
| Transcription failure does not block submit | Async transcription; submit independent of transcript status |

**Code:** `src/app/(protected)/intake/interview/page.tsx`, `src/lib/actions/intake-actions.ts`  
**Tests:** `tests/smoke/client-intake.spec.ts`

---

## US-11 — Review and Approve a Client's Intake (Advisor)

**Status: Partial**

| Criterion | Implementation |
|-----------|----------------|
| Open submitted intake → `IN_REVIEW` + timestamp | `getIntakeReviewData` auto-transitions `SUBMITTED` → `IN_REVIEW` |
| Approve with focus areas + notes → `APPROVED` | `approveClientIntake` stores `focusAreas` on `IntakeApproval` |
| Reject → `REJECTED` | `rejectClientIntake` |
| Waive intake → assessment without interview | **Two paths:** (1) invite `intakeWaived` at send time; (2) advisor `advisor-intake-waiver-actions` sets `ClientAdvisorAssignment.intakeWaivedAt` |

**Gap:** No dedicated Playwright for advisor approve/reject/waiver UI (only intake-waived invite hub in `six-pillar-assessment.spec.ts`).

**Code:** `src/lib/actions/advisor-actions.ts`, `src/lib/actions/advisor-intake-waiver-actions.ts`, `src/components/advisor/ApprovalActions.tsx`

---

## US-12 — Start the Multi-Pillar Assessment (Client)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Approved or waived → create/link assessment | Intake gate in `src/lib/client/intake-gate.ts`; assessment creation on hub load |
| Six pillars presented | `ASSESSMENT_PILLAR_IDS` in `pillar-registry.ts`; hub at `/assessment` |
| Advisor focus areas emphasized at score time | `focusAreas` on approval passed into score route emphasis multiplier |

**Pillar slugs:** `governance`, `cyber-digital`, `physical-security`, `insurance`, `geographic-environmental`, `reputational-social`

**Code:** `src/app/(protected)/assessment/page.tsx`, `src/lib/assessment/pillar-registry.ts`  
**Tests:** `tests/smoke/six-pillar-assessment.spec.ts`

---

## US-13 — Answer Pillar Questions on the Maturity Scale (Client)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Four maturity levels 0–3 | Question bank + `QuestionCard` maturity options |
| Hidden questions not shown | `is_visible` / bank visibility in `pillar-config.ts` |
| Branching show/hide follow-ups | `branching.ts`, profile + answer conditions |
| Skip recorded, excluded from scoring | Store `skippedQuestions`; score route excludes skipped |

**Code:** `src/app/(protected)/assessment/[pillarSlug]/[questionIndex]/page.tsx`, `src/lib/assessment/branching.ts`

---

## US-14 — Save and Resume Assessment Progress (Client)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Return → exact pillar + question + answers | Server resume from assessment responses API; hub uses authoritative position |
| Orphaned answers removed | `orphanedQuestionIds` on responses API; `cleanOrphanedAnswers` in store |
| Server state authoritative | Hub/question pages fetch server progress before local store |

**Code:** `src/app/api/assessment/[id]/responses/route.ts`, `src/lib/assessment/store.ts`

---

## US-15 — Score a Completed Pillar (System)

**Status: Partial — story drift reconciled in code**

| Criterion | Implementation |
|-----------|----------------|
| &lt;50% visible answered → reject with % | Score route completion check |
| ≥50% → weighted rollup, unanswered excluded | Bank-driven scoring via `pillar-config.ts` + scoring engine |
| Focus areas → emphasis multiplier | Focus sub-categories in score route |
| Scoring completes → `COMPLETED` + milestone | **Reconciled:** `syncAssessmentCompletionStatus` sets `COMPLETED` only when **all six** pillars have `PillarScore`; milestone notification fires once at full completion |

**Story update recommended:** Change US-15 last AC to “when all pillars are scored” rather than “when scoring completes” (per-pillar score can succeed while assessment stays `IN_PROGRESS`).

**Code:** `src/app/api/assessment/[id]/score/route.ts`, `src/lib/assessment/assessment-completion.ts`

---

## US-16 — View My Resilience Score and Risk Tier (Client)

**Status: Partial**

| Criterion | Implementation |
|-----------|----------------|
| Maturity 0–3 → resilience % = round((m/3)×100) | Scoring + dashboard display |
| Tier from thresholds Low ≥80, Medium ≥60, High ≥40, else Critical | `RiskThreshold` config + stored tier on `PillarScore` |
| Threshold change does not alter stored tier until rescore | Tier persisted at score time; admin rescore available |

**Gap:** Some dashboard components may still reference legacy `/10` scale — verify `RiskHeatMap` and results page when touching UI.

**Code:** `src/components/assessment/RiskHeatMap.tsx`, `src/app/(protected)/assessment/results/page.tsx`, `src/app/api/assessment/[id]/pillar-scores/route.ts`

---

## US-17 — Surface Priority Control Gaps (System)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Maturity ≤1 → control gap | Scoring engine missing-controls / gap detection |
| Top 5 by priority = weight × gap | Ranking in score results |
| Severity High ≥9, Medium ≥4.5, else Low | Severity mapping in scoring |

**Code:** `src/lib/assessment/scoring.ts`, score route response payload

---

## US-18 — Generate Service Recommendations (System / Advisor)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Rules match when &gt;50% weighted conditions satisfied | Recommendation engine in score transaction |
| Dedupe by service, order by priority, max 10 | Persisted `AssessmentRecommendation` replace set |
| Active rules and services only | DB filters on rule/service status |
| Profile conditions | `evaluateProfileCondition` in `profile-condition.ts` (no longer stub) |

**Code:** `src/lib/assessment/engines/recommendation-engine.ts`, `src/lib/assessment/profile-condition.ts`  
**Tests:** `src/lib/assessment/profile-condition.test.ts`, scoring tests

---

## US-19 — Review the Assessment and Draft a Report (Advisor)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Completed assessment → at most one Draft | Report actions create/open draft with snapshot |
| Edit executive summary + per-rec advisor notes | Report edit UI on pipeline report pages |
| Draft watermark; not visible to client | PDF draft path; client 404 on unpublished |

**Code:** `src/lib/actions/report-actions.ts`, `src/app/(protected)/advisor/pipeline/[clientId]/report/edit/page.tsx`

---

## US-20 — Publish and Download the Risk Report (Advisor / Client)

**Status: Done**

| Criterion | Implementation |
|-----------|----------------|
| Publish → immutable snapshot, new draft version | `publishReport` freezes snapshot, supersedes prior |
| Prior published → superseded, still downloadable | Report status enum + by-id PDF route |
| Co-branded PDF + audit on download | Branding snapshot on report; `writeAudit` on PDF GET |
| Client cannot download un-watermarked without publish | Client role → 404 when no `PUBLISHED` report; `DownloadSection` checks `/availability` |

**Code:** `src/app/api/reports/[id]/pdf/route.tsx`, `src/app/api/reports/[id]/availability/route.ts`, `src/components/reports/DownloadSection.tsx`

---

## Playwright coverage

| Spec | Stories | Status |
|------|---------|--------|
| `tests/smoke/client-intake.spec.ts` | US-10 | Implemented |
| `tests/smoke/six-pillar-assessment.spec.ts` | US-12 (hub, gate, waiver path) | Implemented |
| Full pillar score → publish → client PDF | US-15–US-20 | **Not implemented** |
| Advisor intake approve/reject | US-11 | **Not implemented** |

## Out of epic scope (see other epics)

- Invitation/onboarding before intake → [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md)
- Household profiles & personalization → [Epic 5.3](./EPIC-5.3-household-profiles-personalization.md)
- Word policy templates → [Epic 5.8](./EPIC-5.8-policy-templates-deliverables.md)
- Identity/cyber standalone modules → [Epic 5.9](./EPIC-5.9-extended-risk-modules.md)
