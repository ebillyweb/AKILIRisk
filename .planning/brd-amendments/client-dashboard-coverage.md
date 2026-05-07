# Client `/dashboard` coverage vs BRD §4.3

Round-12 verification item. The advisor-side `/advisor/intelligence`
landed clean in the prior gap analysis. This file walks the
**direct-client** dashboard (`src/app/(protected)/dashboard/page.tsx`)
and the per-pillar **results page**
(`src/app/(protected)/assessment/results/page.tsx`) against BRD §4.3:

> **§4.3 Summary dashboard:** Domain scores, Key risk indicators.

For the §3.3 actor — the direct client — these are the only
score-rendering surfaces.

## What the client sees on `/dashboard`

Server component. Reads `latestIntake`, `intakeGate`, `assessments
{ scores, _count }`, and a global question count. Layout:

1. **Hero card.** Welcome line + a 4-tile metric grid:
   - Intake status (Not started / In progress / Complete / Approved /
     In review / Update needed / Pending review / Waived by advisor)
   - Assessment status (None yet / In progress / Complete)
   - Assessments count
   - MFA on/off
2. **"Your Assessments" card.** One row per Assessment. For each:
   - **In-progress branch** — progress bar, "X of N questions answered,"
     sub-section status row, "Continue Assessment" button.
   - **Completed branch** — single overall score (`X.X / 10`), single
     risk-level badge (`LOW`/`MEDIUM`/`HIGH`), completed date, four
     action buttons (View Results, Download Report, Get Templates,
     Start New).
   - The score + risk level shown are read from `assessment.scores[0]`
     after `orderBy: { calculatedAt: "desc" }, take: 1` — i.e. **one**
     pillar's most recently calculated PillarScore. Which pillar that
     is depends on which one was scored last.
3. **Account Settings card.** Email, MFA toggle, Manage Settings link.

Empty / locked states are handled:
- `assessments.length === 0` → "No assessments yet" + Start
  Assessment button.
- `assessmentUnlocked === false` → "Assessment unlocks after your
  advisor reviews and approves your intake." Disabled Continue button.
  ✅ Graceful.

## What the client sees on `/assessment/results`

Driven by query param + Zustand store. Renders **one pillar at a
time** — `targetPillar` is resolved from the assessment store, not
from a multi-pillar aggregate. Layout:

- Hero with "{Pillar} Assessment Results" + completed date.
- Card with overall score + completion %.
- `<ScoreDisplay />` with the **sub-category** breakdown for the
  active pillar (i.e. categories *within* one pillar, not the six
  pillars themselves).
- `<RiskDrivers />` and `<ActionPlan />` panels driven by
  `pillarScore.missingControls` for the active pillar.
- "Continue to <next pillar>" if more pillars remain incomplete.
- "Return to Dashboard."

There is **no multi-pillar heat-map render** on either surface.
`<RiskHeatMap />` exists at `src/components/assessment/RiskHeatMap.tsx`
and is currently rendered only by the advisor portal
(`/advisor/intelligence` + the per-client view in `ClientDetailView`).
The PDF route does include the heat-map page when pillar scores are
supplied, but the PDF is gated behind a "Download Report" button —
not present in the dashboard's at-a-glance surface.

## Verdict against BRD §4.3

**🟡 Amber.**

What's present:
- ✅ A score is visible on the dashboard for completed assessments.
- ✅ A risk-level badge is visible.
- ✅ Empty + locked states are handled gracefully.
- ✅ The completion progress is visible for in-progress assessments.

What's missing or thin:
- 🟡 **"Domain scores"** is satisfied only at the single-pillar
  granularity. The client never sees all six risk domains
  (governance / cyber-digital / physical-security / insurance /
  geographic-environmental / reputational-social) at a glance. The
  six-cell heat map that exists on the advisor side is the natural
  fit and would close this gap with one component drop into the
  dashboard.
- 🟡 **"Key risk indicators"** is functionally absent in the
  dashboard surface. The closest analogues are the per-pillar
  `missingControls` rendered on `/assessment/results`, but those
  are one click away and only show controls for one pillar at a
  time. KRIs as the BRD likely intends — top-N domains in critical
  state, count of unresolved high-priority controls, etc. — have no
  rendering surface today.
- 🟡 The "score" tile on the hero is **not actually present** —
  the four hero tiles are Intake / Assessment / Assessments-count /
  MFA. There's no "Overall risk: 7.3 / 10" or "Highest-risk domain:
  Cyber" tile. The score lives one card down.

The client does eventually see the score on the dashboard (in the
"Your Assessments" card), and can see per-pillar drill-down by
clicking through to `/assessment/results` for each pillar
sequentially, and can see all six domains by downloading the PDF.
But the **single-screen dashboard** the BRD calls for — domain
scores AND KRIs visible at-a-glance without click-throughs — is not
the experience that ships today.

## Recommended scope for closing the gap (informational — no code in this commit)

Smallest change that would flip the verdict to 🟢:

1. Drop `<RiskHeatMap mode="single-client" pillarScores={…} />` into
   the dashboard, fed by the same `assessment.scores` query already
   running. Add a guard for the empty-state (no scores yet → don't
   render the heat map).
2. Lift the overall score + risk level into a hero tile so it's
   visible at-a-glance without scrolling past the intake/assessment
   status tiles.
3. Optional follow-up: a "Top risks" mini-list rendering the three
   highest-priority `AssessmentRecommendation` rows across all
   pillars — that's the most natural "Key risk indicators" surface
   given existing data.

None of those are blockers for round-12 sign-off; they're the
candidate scope for a §4.3-closing follow-up commit. Sign-off
question: do we treat the BRD's "Summary dashboard" as the literal
`/dashboard` route, or as the experience-across-/dashboard-+-/results?
The amber call is conservative; an experience-across reading lands
much closer to 🟢.
