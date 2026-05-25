# Epic 5.2 — Household Assessment Lifecycle

**Index:** [User stories README](./README.md)  
**BRD:** FR-2 through FR-6; business rules §3.1, §3.2, §3.4  
**Scope:** Intake interview → advisor review → six-pillar questionnaire → scoring & tiers → control gaps & recommendations → advisor report draft/publish  
**Client UI:** `/intake`, `/assessment`, `/assessment/results`, `/dashboard`  
**Advisor UI:** `/advisor/review/[id]`, `/advisor/pipeline/[clientId]/report`  
**Core modules:** `src/lib/intake/*`, `src/lib/assessment/*`, `src/lib/actions/advisor-actions.ts`, `src/lib/actions/report-actions.ts`, `src/app/api/assessment/[id]/score/route.ts`

## Coverage summary

| Story | Title | Status | Tests |
|-------|--------|--------|--------|
| US-10 | Complete intake interview | **Done** | `client-intake.spec.ts` |
| US-11 | Review and approve intake | **Done** | `epic-5.2-advisor-intake-approval.spec.ts` |
| US-12 | Start multi-pillar assessment | **Done** | `six-pillar-assessment.spec.ts` |
| US-13 | Answer on maturity scale | **Done** | `epic-5.2-assessment-progress.spec.ts` |
| US-14 | Save and resume progress | **Done** | `epic-5.2-assessment-progress.spec.ts` |
| US-15 | Score pillars & complete assessment | **Done** | `prepare` test API + `epic-5.2-report-publish.spec.ts` |
| US-16 | View resilience & risk tier | **Done** | `epic-5.2-dashboard-heatmap.spec.ts` |
| US-17 | Surface control gaps | **Done** | Scoring unit tests |
| US-18 | Generate service recommendations | **Done** | `profile-condition.test.ts`, score route |
| US-19 | Draft report (advisor) | **Done** | `epic-5.2-report-publish.spec.ts` |
| US-20 | Publish & download report | **Done** | `epic-5.2-report-publish.spec.ts` |

---

## Reconciled acceptance criteria (US-10 – US-20)

These criteria reflect **implemented behavior** as of the six-pillar reconciliation. Where they differ from an earlier story draft, the code is authoritative.

### US-10 — Complete the Intake Interview (Client)

- Per-question audio and/or typed response is saved; audio is queued for transcription.
- Submit is refused until every scripted question has a response.
- Submit sets intake to **Submitted** and notifies assigned advisors.
- Transcription failure does **not** block submit.

### US-11 — Review and Approve a Client's Intake (Advisor)

- Opening a **Submitted** intake moves approval to **In Review** and records review time (`getIntakeReviewData`).
- Approve with focus areas + notes → **Approved**; focus areas stored on `IntakeApproval`.
- Reject → **Rejected**.
- Waive intake: invite-time `intakeWaived` **or** advisor sets `ClientAdvisorAssignment.intakeWaivedAt`.

### US-12 — Start the Multi-Pillar Assessment (Client)

- With intake **Approved** or waived, client can start/access assessment linked to approval when present.
- Hub presents six pillars: Governance, Cyber/Digital, Physical Security, Insurance, Geographic/Environmental, Reputational/Social.
- Advisor focus areas apply an emphasis multiplier at **score** time.

### US-13 — Answer Pillar Questions on the Maturity Scale (Client)

- Scored questions use maturity **0–3** (Critical gap → Institutionalized).
- Administrator-hidden questions are not shown (`is_visible` / bank).
- Answer-based branching shows/hides follow-ups.
- Skipped questions are recorded and excluded from scoring.

### US-14 — Save and Resume Assessment Progress (Client)

- Server state is authoritative for resume pillar + question index.
- Orphaned answers (hidden by branching) are removed server-side and from client store.
- Answers persist via assessment responses API.

### US-15 — Score Pillars and Complete the Assessment (System)

- Scoring a pillar is rejected if **&lt;50%** of that pillar’s **visible** questions are answered (message includes %).
- With ≥50% answered, rollup uses weighted average of answered questions only; unanswered are excluded (not scored as 0).
- Focus areas increase emphasis on matching sub-categories in the rollup.
- **Per pillar:** a `PillarScore` row is written when that pillar’s score succeeds.
- **Assessment status:** remains `IN_PROGRESS` until **all six** canonical pillars have a `PillarScore`; then status becomes `COMPLETED` and a single milestone notification fires (`syncAssessmentCompletionStatus`).

> **Reconciliation note:** Earlier drafts said “when scoring completes” the assessment becomes Completed after **one** pillar. The product requires **all six** pillars scored—matching the six-pillar hub (US-12).

### US-16 — View My Resilience Score and Risk Tier (Client)

- Maturity 0–3 maps to resilience %: `round((maturity / 3) × 100)`, capped at 100.
- Tier from active thresholds: Low ≥80%, Medium ≥60%, High ≥40%, else Critical.
- Threshold changes do not alter stored tier until re-score.

### US-17 — Surface Priority Control Gaps (System)

- Normalized maturity ≤1 → control gap.
- Top **5** gaps by priority = weight × maturity gap.
- Severity: High if priority ≥9, Medium if ≥4.5, else Low.
- Per-gap remediation text comes from the question bank (`remediationAction`, then `learnMore` / `helpText`) and appears in the results **Action plan** and PDF itemized recommendations.

### US-17b — Surface Pillar Summary Narratives (System)

Pillar-level paragraphs are **product copy** in code (`pillar-outcome-expectations.ts`, `pillar-outcome-expectations-mid-band.ts`), not the admin recommendation catalog (US-39/40).

| Profile | Narrative shown |
|--------|------------------|
| **Critical** + every visible answer at lowest maturity | All-negative pillar block (e.g. governance estate + family governance paragraph) |
| **Low** + every visible answer at highest maturity | All-yes pillar block |
| **Any other** scored profile | Mid-band paragraph for that pillar’s stored risk tier (`critical`, `high`, `medium`, or `low`) |

- Mixed NO/YES answers use the mid-band paragraph for the aggregate tier, plus per-question gaps from US-17 (not the all-negative or all-yes blocks).
- Narratives are returned on `POST`/`GET` `/api/assessment/[id]/score` as `pillarNarratives` and rendered on `/assessment/results` (Action plan summary).
- Published report snapshots include `reportData.pillarNarratives` and a dedicated PDF **Pillar Summary** page (`buildReportSnapshot`, `PillarNarrativeSection`).

### US-18 — Generate Service Recommendations (System / Advisor)

- Active rules: match when **&gt;50%** of weighted conditions satisfied.
- Dedupe by service, order by priority; at most **10** persisted per assessment (replaces prior set).
- Only active rules and services; profile conditions use `evaluateProfileCondition`.
- Catalog services are distinct from pillar summary narratives (US-17b); both may appear on the same assessment.

### US-19 — Review the Assessment and Draft a Report (Advisor)

- Completed assessment: at most one **Draft** report with snapshot data.
- Snapshot includes pillar summary narratives (US-17b) at publish/draft build time from live answers + stored tier.
- Advisor edits executive summary and per-recommendation notes on draft.
- Draft PDF is watermarked; **clients** cannot access un-published PDF.

### US-20 — Publish and Download the Risk Report (Advisor / Client)

- Publish freezes an immutable **Published** snapshot; opens next-version **Draft**.
- Prior Published → **Superseded**, still downloadable.
- Client, assigned advisor, and admins may download co-branded PDF; download is audited.
- Client receives **404** on PDF until a Published report exists (`/availability` + PDF route).

---

## Implementation map

| Story | Primary code |
|-------|----------------|
| US-10 | `intake-actions.ts`, `/intake/interview` |
| US-11 | `advisor-actions.ts`, `advisor-intake-waiver-actions.ts`, `ApprovalActions.tsx` |
| US-12 | `pillar-registry.ts`, `/assessment/page.tsx` |
| US-13–14 | `[pillarSlug]/[questionIndex]/page.tsx`, `responses/route.ts`, `store.ts` |
| US-15–18 | `score/route.ts`, `assessment-completion.ts`, `scoring.ts`, `pillar-outcomes.ts`, recommendation engine |
| US-17b | `pillar-outcome-expectations*.ts`, `pillar-outcomes.ts`, `PillarNarrativeSummary.tsx`, `build-report-snapshot.ts` |
| US-19–20 | `report-actions.ts`, `reports/[id]/pdf`, `DownloadSection.tsx` |

**Pillar slugs:** `governance`, `cyber-digital`, `physical-security`, `insurance`, `geographic-environmental`, `reputational-social`

---

## Playwright coverage

| Spec | Stories |
|------|---------|
| `tests/smoke/client-intake.spec.ts` | US-10 |
| `tests/smoke/epic-5.2-advisor-intake-approval.spec.ts` | US-11 (approve + reject) |
| `tests/smoke/six-pillar-assessment.spec.ts` | US-12 (hub, gate, waiver) |
| `tests/smoke/epic-5.2-assessment-progress.spec.ts` | US-13 (maturity UI), US-14 (resume + server authority) |
| `tests/smoke/epic-5.2-dashboard-heatmap.spec.ts` | US-16 (populated + empty heat map) |
| `tests/smoke/epic-5.2-report-publish.spec.ts` | US-15–16 (prepare API), US-19–20 |

**Test-only API:** `POST /api/test/assessment/prepare` (requires `ENABLE_TEST_AUTH=1`)

- `{ clientEmail, reset: true, complete: true }` — score all six pillars (report/dashboard tests)
- `{ clientEmail, reset: true, complete: false }` — wipe progress only (`resetAssessmentProgress` helper)

See `tests/helpers/assessment.ts`.

---

## Out of epic scope

- [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md) — invitations  
- [Epic 5.3](./EPIC-5.3-household-profiles-personalization.md) — household profiles  
- [Epic 5.8](./EPIC-5.8-policy-templates-deliverables.md) — Word policy templates  
- [Epic 5.9](./EPIC-5.9-extended-risk-modules.md) — legacy identity/cyber/intelligence surfaces
