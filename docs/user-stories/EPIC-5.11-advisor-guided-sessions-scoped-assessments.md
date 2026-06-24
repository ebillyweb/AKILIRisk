# Epic 5.11 — Advisor-Guided Sessions & Scoped Assessments

**Index:** [User stories README](./README.md)  
**BRD:** Extends FR-2, FR-3, FR-4 (intake approval, assessment scope, advisor workflow)  
**Depends on:** [Epic 5.2](./EPIC-5.2-household-assessment-lifecycle.md) (US-10–US-20), [Epic 5.4](./EPIC-5.4-advisor-workspace-pipeline.md)  
**Scope:** Advisor selects 1–6 assessment pillars at approval; intake-driven pillar recommendations; assessment locked until approved; optional advisor-led (facilitated) intake + assessment through risk preview  
**Client UI:** `/assessment`, `/assessment/risk-preview`, `/dashboard`  
**Advisor UI:** `/advisor/review/[id]`, `/advisor/facilitate/*`, `/advisor/pipeline`  
**Core modules (planned):** `src/lib/intake/pillar-recommendations.ts`, `src/lib/assessment/included-pillars.ts`, `src/lib/facilitated/*`, `src/lib/client/intake-gate.ts`, `src/components/advisor/ReviewSidebar.tsx`

## Coverage summary

| Story | Title | Status | Tests |
|-------|--------|--------|--------|
| US-67 | Scope assessment to included pillars (system) | **Done** (Phase 1) | Unit: `included-pillars`, `syncAssessmentCompletionStatus` |
| US-68 | Lock assessment until advisor approves with pillars | **Done** (Phase 2) | `intake-gate.test.ts` |
| US-69 | Select assessment domains at intake approval | **Done** (Phase 2) | `epic-5.11-pillar-selection-approval.spec.ts` (smoke TBD) |
| US-70 | View intake-based pillar recommendations | **Done** (Phase 2) | Unit: `computePillarRecommendations` |
| US-71 | Set scoring emphasis within included pillars | **Done** (Phase 2) | Approve schema + emphasis UI |
| US-72 | Client sees scoped assessment hub | **Done** (Phase 3) | Unit: scope helpers, heat-map filter; smoke TBD |
| US-73 | Start a facilitated client session | **Done** | `epic-5.11-facilitated-session-start.spec.ts` |
| US-74 | Conduct facilitated intake | **Done** | `epic-5.11-facilitated-intake.spec.ts` |
| US-75 | Conduct facilitated assessment through risk preview | **Done** | `epic-5.11-facilitated-assessment.spec.ts` |
| US-76 | Review completed sessions in advisor queue | **Planned** | `epic-5.11-session-review-queue.spec.ts` |
| US-77 | Tag intake questions with related pillars (admin) | **In progress** (Phase 1 admin UI) | Admin intake question edit + unit tests |

## Supersedes / amends (Epic 5.2)

When Epic 5.11 ships, update reconciled criteria for:

| Story | Change |
|-------|--------|
| **US-11** | Approve requires **included pillars** (1–6), not focus areas alone |
| **US-12** | Hub shows **included** pillars only; client cannot start before approval + pillar selection |
| **US-15** | Assessment **COMPLETED** when all **included** pillars scored (not all six by default) |

---

## US-67 — Scope Assessment to Included Pillars (System)

**As** the platform  
**I want** each assessment to carry an explicit list of 1–6 included pillar IDs  
**So that** completion, risk preview, and reporting respect advisor-chosen scope rather than assuming all six domains

### Acceptance criteria

- **Given** a new assessment is created after Epic 5.11 ships  
  **When** an advisor approves an intake with pillars `[governance, cyber-digital]`  
  **Then** the linked `Assessment.includedPillars` equals that list (canonical IDs from `ASSESSMENT_PILLAR_IDS`).

- **Given** an assessment with `includedPillars` of length *N* where 1 ≤ N ≤ 6  
  **When** the client or advisor scores pillars  
  **Then** only pillars in `includedPillars` may be started, scored, or shown on the hub.

- **Given** an assessment where every included pillar has a `PillarScore` row  
  **When** `syncAssessmentCompletionStatus` runs  
  **Then** status becomes `COMPLETED`, `enterPreview` runs, and milestone notifications fire.

- **Given** an assessment where at least one **included** pillar lacks a `PillarScore`  
  **When** other (non-included) pillars are fully scored  
  **Then** status remains `IN_PROGRESS` and risk preview stays locked.

- **Given** legacy assessments with null or empty `includedPillars`  
  **When** completion or preview is evaluated  
  **Then** the system treats all six canonical pillars as included (back-compat migration).

- **Given** invalid pillar IDs in an approval payload  
  **When** approve is submitted  
  **Then** the request is rejected with a validation error (no partial write).

---

## US-68 — Lock Assessment Until Advisor Approves With Pillars (Client / System)

**As** a client  
**I want** the assessment to stay unavailable until my advisor approves my intake and selects which domains to assess  
**So that** I only work on pillars my advisor has scoped for me

### Acceptance criteria

- **Given** a client with a **Submitted** intake and approval status **PENDING** or **IN_REVIEW**  
  **When** the client navigates to `/assessment` or follows an assessment link  
  **Then** they are blocked with copy explaining the advisor must approve and select domains first (not a generic 404).

- **Given** a client whose intake is **Approved** but `includedPillars` is empty (data error / pre-migration)  
  **When** `getClientIntakeGateState` runs  
  **Then** `assessmentUnlocked` is **false**.

- **Given** a client whose intake is **Approved** with at least one `includedPillar`  
  **When** the client opens `/assessment`  
  **Then** `assessmentUnlocked` is **true** and the hub loads.

- **Given** a client with intake **waived** (`intakeWaivedAt` set) and no approval row  
  **When** they attempt to start an assessment  
  **Then** assessment remains locked until an advisor explicitly sets `includedPillars` via waiver follow-up or facilitated session (waived ≠ auto-unlock unless product adds a separate waiver pillar default — **default: still requires advisor pillar pick**).

- **Given** a client with **Rejected** intake  
  **When** they attempt `/assessment`  
  **Then** access is denied with rejection guidance (contact advisor).

- **Given** an approved client  
  **When** the advisor later creates a **new** assessment cycle (future extension)  
  **Then** out of scope for v1; v1 assumes one active in-progress assessment per approval path.

---

## US-69 — Select Assessment Domains at Intake Approval (Advisor)

**As** an assigned advisor  
**I want** to choose one to six assessment pillars when I approve a client's intake  
**So that** the client's questionnaire matches the engagement scope we agreed in review

### Acceptance criteria

- **Given** a **Submitted** intake assigned to me on `/advisor/review/[id]`  
  **When** I open the approval sidebar  
  **Then** I see an **Assessment domains** checklist for all six pillars with clear labels and summaries.

- **Given** I have selected zero pillars  
  **When** I click **Approve**  
  **Then** approval fails with “Select at least one assessment domain” and no status change.

- **Given** I have selected between 1 and 6 pillars  
  **When** I approve with optional notes  
  **Then** `IntakeApproval.status` is `APPROVED`, `includedPillars` is persisted, `approvedAt` is set, and the client is notified.

- **Given** I attempt to select more than six pillars  
  **When** I submit  
  **Then** the UI prevents a seventh selection (checkbox disabled or validation error).

- **Given** I have already **Approved** an intake  
  **When** I return to the review page  
  **Then** included pillars are read-only unless a future “amend scope” story is implemented (v1: immutable after approve).

- **Given** I **Reject** the intake  
  **When** reject completes  
  **Then** no `includedPillars` are written and assessment remains locked for the client.

- **Given** a facilitated session (US-73) where I am the facilitator  
  **When** I complete intake and reach pillar selection  
  **Then** the same domain picker and validation apply before assessment starts.

---

## US-70 — View Intake-Based Pillar Recommendations (Advisor)

**As** an assigned advisor  
**I want** recommended actions showing which pillars fit this client based on their intake  
**So that** I can make an informed domain selection without re-reading every transcript

### Acceptance criteria

- **Given** a **Submitted** intake with at least one answered question that has `relatedPillarIds` configured (US-77)  
  **When** I open `/advisor/review/[id]`  
  **Then** I see a **Recommended domains** panel ranking pillars with strength **Strong**, **Moderate**, or **Low**.

- **Given** a pillar ranked **Strong**  
  **When** the panel renders  
  **Then** it shows at least one evidence line: intake question reference + short excerpt from the client's response (transcription or typed text, PII-safe truncation).

- **Given** an intake question with `recommendedActions` in the question bank  
  **When** that question contributes to a pillar's score  
  **Then** the pillar row includes a **Suggested action** line sourced from that field (or aggregated top action).

- **Given** recommendations are computed  
  **When** I approve the intake  
  **Then** a snapshot of recommendations (`pillarRecommendations` JSON on `IntakeApproval`) is stored for audit even if I override the pre-filled checkboxes.

- **Given** no intake questions are tagged with pillar IDs  
  **When** I open review  
  **Then** the panel shows neutral copy (“No automated recommendations — select domains manually”) and all pillars appear **Low**; approval still works.

- **Given** I click an evidence link in the recommendation panel  
  **When** the link activates  
  **Then** the main column scrolls to or highlights the matching intake Q&A block.

- **Given** **Strong** recommendations exist  
  **When** the domain picker first loads  
  **Then** **Strong** pillars are pre-checked as suggestions; I may uncheck any before approving.

- **Given** a **Select all recommended** control  
  **When** I activate it  
  **Then** all **Strong** and **Moderate** pillars are checked in the domain picker.

---

## US-71 — Set Scoring Emphasis Within Included Pillars (Advisor)

**As** an assigned advisor  
**I want** to optionally mark which included pillars deserve extra scoring emphasis  
**So that** focus areas from intake review still influence rollup weighting without changing which pillars are in scope

### Acceptance criteria

- **Given** I have selected included pillars `[governance, cyber-digital, insurance]`  
  **When** I optionally open **Emphasis areas** (subset control)  
  **Then** I may select zero to N emphasis pillars where each emphasis ID ∈ included pillars.

- **Given** I select emphasis `[cyber-digital]` only  
  **When** I approve  
  **Then** `IntakeApproval.focusAreas` equals `[cyber-digital]` and scoring uses existing emphasis multipliers for that pillar.

- **Given** I do not change emphasis  
  **When** I approve with included pillars only  
  **Then** `focusAreas` defaults to **all included pillars** (same as included list).

- **Given** I attempt emphasis on a pillar not in `includedPillars`  
  **When** I submit approve  
  **Then** validation rejects the request.

- **Given** an approved assessment is scored  
  **When** `getCustomizationConfig(focusAreas)` runs  
  **Then** behavior matches Epic 5.2 US-12/US-15 emphasis rules, scoped to included pillars only.

---

## US-72 — Client Sees Scoped Assessment Hub (Client)

**As** an approved client  
**I want** the assessment hub to show only the domains my advisor selected  
**So that** I am not asked to complete pillars outside my engagement scope

### Acceptance criteria

- **Given** my approval includes `[governance, reputational-social]`  
  **When** I open `/assessment`  
  **Then** exactly two pillar cards appear; the other four are not shown (not merely disabled).

- **Given** my scoped assessment  
  **When** I view hub progress  
  **Then** copy reads “0 of 2 domains complete” (or equivalent), not “of 6”.

- **Given** I complete and score both included pillars  
  **When** completion sync runs  
  **Then** I may open `/assessment/risk-preview` and the heat map shows **only** those two pillars.

- **Given** a scoped assessment  
  **When** I view the hub header or customization banner  
  **Then** I see which domains my advisor selected (names list or count + tooltip).

- **Given** I deep-link to `/assessment/cyber-digital/0` for a pillar **not** in my scope  
  **When** the page loads  
  **Then** I am redirected to `/assessment` with an explanatory message.

- **Given** risk preview  
  **When** rendered for a 2-pillar scope  
  **Then** overall summary copy clarifies scope (“Based on 2 of 6 household risk domains selected by your advisor”).

---

## US-73 — Start a Facilitated Client Session (Advisor)

**As** an advisor  
**I want** to start a live session by choosing an existing client or creating a new one  
**So that** I can conduct intake and assessment in person or on a call without the client logging in

### Acceptance criteria

- **Given** I am signed in as **ADVISOR** with an active subscription within client limits  
  **When** I click **Start client session** from the advisor hub or pipeline  
  **Then** I see options: **Select existing client** (searchable portfolio list) and **Create new client** (name + email minimum).

- **Given** I select an existing assigned client  
  **When** I confirm  
  **Then** a `FacilitatedSession` row is created in status `INTAKE` linked to that `clientId` and my `advisorProfileId`.

- **Given** I create a new client with valid email not used by a non-USER role  
  **When** I submit  
  **Then** the system creates `User` (USER), `ClientProfile`, `ClientAdvisorAssignment` (ACTIVE), and a facilitated session — without requiring an invitation email (v1: optional notify later).

- **Given** I am not assigned to the client  
  **When** I attempt to start a session via client ID  
  **Then** access is denied (same isolation as intake review).

- **Given** an in-progress facilitated session for the same client and advisor  
  **When** I start again  
  **Then** v1 offers **Resume session** or **Start new** (product choice: default **Resume** if session &lt; 24h old).

- **Given** enterprise firm membership  
  **When** I start a session  
  **Then** firm portfolio scoping rules match Epic 5.4 pipeline access.

---

## US-74 — Conduct Facilitated Intake (Advisor)

**As** an advisor facilitating a session  
**I want** to walk through the intake interview on behalf of my client  
**So that** responses are captured in the client's intake record for review and pillar recommendations

### Acceptance criteria

- **Given** an active facilitated session in status `INTAKE`  
  **When** I enter `/advisor/facilitate/[sessionId]/intake`  
  **Then** I see the same step-by-step intake experience as the client (one question per screen, audio and/or typed response).

- **Given** a persistent banner “Completing intake for {Client Name}”  
  **When** I navigate the intake wizard  
  **Then** the banner remains visible on every step.

- **Given** I record audio for a question  
  **When** upload and transcription run  
  **Then** `IntakeResponse` rows attach to the **client's** `IntakeInterview`, and audio auth allows my advisor role for this assignment.

- **Given** I answer the final question  
  **When** intake submits  
  **Then** interview status is **Submitted**, session moves to `PILLAR_SELECT`, and US-70 recommendations are computed.

- **Given** facilitated intake submit  
  **When** approval is processed in the same session  
  **Then** I proceed to pillar selection (US-69) without a separate async “awaiting review” state for **this** session (facilitator auto-approves).

- **Given** another advisor is assigned to the same client but not facilitating  
  **When** I submit facilitated intake  
  **Then** optional notification fires; their pipeline may show the intake unless auto-approved clears `awaitingIntakeReview`.

- **Given** all intake actions  
  **When** persisted  
  **Then** audit log records `facilitatedSessionId` and advisor as actor.

---

## US-75 — Conduct Facilitated Assessment Through Risk Preview (Advisor)

**As** an advisor facilitating a session  
**I want** to lead the scoped assessment and view the risk preview with the client  
**So that** we finish the live engagement and the case enters my review queue for follow-up

### Acceptance criteria

- **Given** I approved domain selection in the facilitated session  
  **When** assessment starts  
  **Then** session status is `ASSESSMENT`, `Assessment.includedPillars` matches my selection, and I enter the questionnaire for the first included pillar.

- **Given** I am facilitating  
  **When** I answer questions  
  **Then** `AssessmentResponse` rows attach to the **client's** assessment; APIs authorize via facilitated session, not client login.

- **Given** included pillars `[governance, cyber-digital, insurance]`  
  **When** I use the facilitated hub  
  **Then** only those three pillars appear; I must score each (≥50% visible questions per US-15) to complete scope.

- **Given** all included pillars are scored  
  **When** completion sync runs  
  **Then** assessment is `COMPLETED`, deliverable phase enters **PREVIEW**, and session status becomes `PREVIEW`.

- **Given** session is in `PREVIEW`  
  **When** I open `/advisor/facilitate/[sessionId]/preview`  
  **Then** I see the risk heat map and top risks for **included pillars only** (same data as client risk preview).

- **Given** I click **Finish session** on preview  
  **When** the action completes  
  **Then** session status is `COMPLETE`, pipeline shows the client in **ready for profile review**, and optional client notification is sent per product setting (US-76).

- **Given** I leave mid-assessment  
  **When** I return to **Resume session**  
  **Then** progress resumes from server state (pillar + question index) for the client's assessment.

- **Given** facilitated completion  
  **When** `triggerPreviewAvailable` runs  
  **Then** assigned advisor receives “Questionnaire complete — Preview available” (existing notification path).

---

## US-76 — Review Completed Sessions in Advisor Queue (Advisor)

**As** an advisor  
**I want** clients who finished a live session to appear in my workflow queue for profile review and report work  
**So that** I can follow up after the meeting without losing track of them

### Acceptance criteria

- **Given** a facilitated session reached `COMPLETE` or an async client finished a scoped assessment to PREVIEW  
  **When** I open `/advisor/pipeline` or the advisor dashboard  
  **Then** the client appears with a stage indicating **Preview ready — review & publish** (or equivalent badge).

- **Given** pipeline metrics  
  **When** at least one client is in PREVIEW with unpublished profile  
  **Then** a priority card counts them separately from **intakes awaiting review**.

- **Given** I click the queue item  
  **When** navigation completes  
  **Then** I land on `/advisor/pipeline/[clientId]/assessment/[assessmentId]` or report draft entry with scope summary (included pillars + completion date).

- **Given** a client completed 2 of 6 pillars only  
  **When** shown in queue  
  **Then** scope label reads “2 domains assessed: Governance, Cyber” (not “incomplete six-pillar assessment”).

- **Given** intake was client-submitted (not facilitated) and assessment reached PREVIEW  
  **When** pipeline computes stage  
  **Then** the same **Preview ready** signal applies (unified queue, different session source).

- **Given** I publish the Risk Profile (Epic 5.2 US-20)  
  **When** publish succeeds  
  **Then** the preview-ready queue item clears for that assessment cycle.

---

## US-77 — Tag Intake Questions With Related Pillars (Admin)

**As** a platform admin  
**I want** to associate each intake script question with one or more assessment pillars  
**So that** the system can generate pillar recommendations for advisors at approval time

### Acceptance criteria

- **Given** I edit an intake question at `/admin/intake/questions/[questionId]/edit`  
  **When** I save  
  **Then** I can set **Related pillars** as a multi-select of the six canonical pillar IDs (0–6 selections allowed; 0 = no recommendation contribution).

- **Given** a question tagged with `[cyber-digital, reputational-social]`  
  **When** a client answers that question in an interview  
  **Then** US-70 adds weight to both pillars in the recommendation engine.

- **Given** intake questions loaded via `loadIntakeScriptQuestions`  
  **When** served to advisor review  
  **Then** related pillar IDs are available to the recommendation engine (server-side only; not required client UI).

- **Given** a bulk seed or Belvedere workbook import  
  **When** intake rows are loaded  
  **Then** documentation specifies a column or mapping file for `relatedPillarIds` (follow-up content task; not blocking US-77 UI).

- **Given** invalid pillar ID in admin form  
  **When** I save  
  **Then** validation rejects unknown IDs.

---

## Non-functional requirements

| Area | Requirement |
|------|-------------|
| **Security** | All facilitated mutations require ACTIVE `ClientAdvisorAssignment`; generic 404 on cross-tenant probes |
| **Audit** | Approve, facilitated submit, and session complete write audit rows with actor + client + session IDs |
| **Migration** | Existing assessments: `includedPillars` = all six; existing approvals: infer included from `focusAreas` if non-empty, else all six |
| **Performance** | Recommendation compute on review page &lt; 500ms for typical 10-question intake |
| **Accessibility** | Domain picker and recommendations keyboard-operable; strength not color-only |

## Test plan (Epic-level)

1. Unit: `computePillarRecommendations`, `getAssessmentIncludedPillars`, scoped `syncAssessmentCompletionStatus`
2. Smoke: approve with 2 pillars → client hub shows 2 → score both → preview unlocks
3. Smoke: client blocked on `/assessment` before approve
4. Smoke: full facilitated path — create client → intake → pick 1 pillar → assess → preview → pipeline queue
5. Regression: legacy six-pillar assessments still complete and preview correctly after migration

## Phased implementation order

Build in five phases. Each phase is shippable to staging; later phases depend on earlier ones. **Do not start facilitated sessions (Phase 4) until scoped completion and approval gates (Phases 1–3) are verified.**

### Phase 1 — Scoped assessment platform (foundation)

**Goal:** Partial-pillar assessments work end-to-end in data and completion logic; no new advisor UI yet.

| Stories | Work |
|---------|------|
| **US-67** | `Assessment.includedPillars`, migration + backfill, `getAssessmentIncludedPillars()`, update `syncAssessmentCompletionStatus`, summary gate, score route |
| **US-77** (schema + admin only) | `relatedPillarIds` on intake questions; admin multi-select; seed/mapping doc for content team |

**Exit criteria**

- Unit tests: 1-, 3-, and 6-pillar completion paths
- Legacy assessments still complete (backfill = all six)
- Admin can tag intake questions with pillars

**Depends on:** nothing  
**Enables:** Phases 2–5  
**Rough effort:** 1–1.5 weeks

---

### Phase 2 — Approval gate & pillar selection (advisor)

**Goal:** Advisor must pick 1–6 domains to unlock the client assessment; recommendations inform the choice.

| Stories | Work |
|---------|------|
| **US-68** | `getClientIntakeGateState` requires approved + non-empty `includedPillars`; block `/assessment` and APIs |
| **US-69** | `IntakeApproval.includedPillars`; domain picker on `/advisor/review/[id]`; approve schema + action |
| **US-70** | `computePillarRecommendations()`; recommendations panel; snapshot on approve; pre-fill Strong |
| **US-71** | Emphasis subset ⊆ included; default focusAreas = included; fix `RiskAreaSelector` copy |

**Exit criteria**

- Smoke: approve with 2 pillars → client hub blocked before approve, unlocked after
- Smoke: recommendations panel with tagged intake fixture
- Update approve flow tests (`epic-5.2-advisor-intake-approval.spec.ts`)

**Depends on:** Phase 1 (`includedPillars` persistence)  
**Enables:** Phase 3 (client hub), Phase 4 (facilitated pillar pick uses same UI)  
**Rough effort:** 1.5–2 weeks

**Ship note:** This is the **first user-visible milestone** for async (client-led) intake path.

---

### Phase 3 — Client scoped experience

**Goal:** Approved clients see and complete only their scoped domains; preview matches scope.

| Stories | Work |
|---------|------|
| **US-72** | Scoped hub (filter cards, progress copy); block out-of-scope deep links; scoped risk preview banner |

**Exit criteria**

- Smoke: 2-pillar approval → hub shows 2 → score both → preview with 2-pillar heat map
- Regression: 6-pillar approval behaves like today

**Depends on:** Phases 1–2  
**Enables:** Phase 4 preview parity  
**Rough effort:** 3–5 days

**Can parallelize with:** late Phase 2 (once approve writes `includedPillars` on assessment create)

---

### Phase 4 — Facilitated sessions (advisor-led)

**Goal:** Advisor can run intake + scoped assessment + preview in one live session.

| Stories | Work |
|---------|------|
| **US-73** | `FacilitatedSession` model, start/resume, pick/create client, `/advisor/facilitate` entry |
| **US-74** | Facilitated intake routes + auth on intake/audio APIs; auto-approve + pillar pick inline |
| **US-75** | Facilitated assessment routes + API auth; scoped hub in session; preview + finish session |

**Exit criteria**

- Smoke: create client → facilitated intake → pick 1 pillar → complete → preview → finish
- Audit rows on facilitated mutations
- No client login required for session path

**Depends on:** Phases 1–3 (reuse domain picker, completion, preview)  
**Enables:** Phase 5 queue signals  
**Rough effort:** 2–2.5 weeks

**Build order within phase:** US-73 → US-74 → US-75 (strict sequence)

---

### Phase 5 — Queue, notifications & reconciliation

**Goal:** Completed scoped assessments surface in advisor workflow; docs and Epic 5.2 stories reconciled.

| Stories | Work |
|---------|------|
| **US-76** | Pipeline stage/badge “Preview ready”; dashboard priority card; scope labels on queue rows |
| **US-77** (content) | Intake bank / workbook mapping for all intake questions → pillars |
| **Epic 5.2 amend** | Update US-11, US-12, US-15 reconciled criteria in epic doc + tests |

**Exit criteria**

- Facilitated + async clients both appear in preview-ready queue
- `tests/INVENTORY.md` updated with `epic-5.11-*.spec.ts`
- Content: ≥80% of visible intake questions tagged (or accept empty recommendations for untagged)

**Depends on:** Phases 1–4  
**Rough effort:** 1 week

---

### Summary timeline

```text
Phase 1  ████████░░░░░░░░░░░░  Platform (US-67, US-77 admin)
Phase 2  ░░░░████████████░░░░  Approval + recommendations (US-68–71)
Phase 3  ░░░░░░░░████░░░░░░░░  Client scoped hub (US-72)
Phase 4  ░░░░░░░░░░░░████████  Facilitated sessions (US-73–75)
Phase 5  ░░░░░░░░░░░░░░░░████  Queue + content + doc reconcile (US-76–77)
```

**Total:** ~6–8 weeks sequential; **~5–6 weeks** if Phase 3 starts when Phase 2 approve path lands.

### Recommended staging releases

| Release | Phases | Audience value |
|---------|--------|----------------|
| **R1** | 1 + 2 | Advisors scope assessments at approval; clients blocked until approved |
| **R2** | 3 | Clients see scoped hub and preview |
| **R3** | 4 + 5 | Live advisor-led sessions + pipeline queue |

### Defer if schedule is tight

- **US-71** emphasis subset UI → ship with focusAreas = included only; add nested emphasis control later
- **US-77 content mapping** → ship panel with “no recommendations” until content ready (engine works with partial tags)
- **Resume session** (US-73) → v1.1; v1 always start fresh or single open session per client

### Do not defer

- **US-67** before any UI (everything else assumes scoped completion)
- **US-68 + US-69** before client hub changes (avoid unlocked full six-pillar hub)
- Facilitated **API authorization** (US-74–75) — security-critical; not a polish item

---

## Related docs

- [Epic 5.2 — Household Assessment Lifecycle](./EPIC-5.2-household-assessment-lifecycle.md) — amended by US-67–US-72
- [Epic 5.4 — Advisor Workspace & Pipeline](./EPIC-5.4-advisor-workspace-pipeline.md) — queue metrics extended by US-76
- [.planning/research/INTAKE_ARCHITECTURE.md](../../.planning/research/INTAKE_ARCHITECTURE.md) — advisor review flow
