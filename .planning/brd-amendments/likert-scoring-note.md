# BRD §4.1 amendment note — Likert scoring semantics

> **Header note for the maintainer:** this file captures a scoring nuance
> that should be documented in the next §4.1 revision (when BRD §4.1 is
> updated to mention the Likert question type explicitly, alongside the
> Yes/No and Multiple-choice types it already lists). The repo copy is
> the source of truth until the Drive BRD is updated.

---

## §4.1 Likert scoring semantics

When BRD §4.1 is revised to mention the Likert question type explicitly,
document that "Strongly disagree" (1) maps to **0.6** normalized maturity
(out of 3.0), **not 0.0**.

The 5-point Likert scale is treated as a continuous 1-to-5 mapping into
the maturity range via `(answer / 5) × 3`:

| Likert answer | Normalized maturity (0–3) |
|---|---|
| 1 — Strongly disagree | 0.6 |
| 2 — Disagree | 1.2 |
| 3 — Neutral | 1.8 |
| 4 — Agree | 2.4 |
| 5 — Strongly agree | 3.0 |

This preserves the distinction between "answered 1" (a real low score —
the respondent expressed an opinion) and "did not answer" (excluded from
the weighted average per `scoring.ts`'s `calculatePillarScore`).
Treating Likert 1 as zero maturity would conflate the two.

### If product later wants Likert 1 = 0.0 maturity

Single-line behavior change: in
`src/lib/assessment/bank/pillar-question-wire.ts:wireForLikert5`, swap
the default scoreMap from

```ts
scoreMap: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 }
```

to

```ts
scoreMap: { "1": 0, "2": 1, "3": 1.5, "4": 2, "5": 3 }
```

The renderer (`LikertScale` in `src/components/assessment/AnswerOptions.tsx`)
is unaffected — it always presents the 1–5 pip continuum to the user;
the scoreMap is the only thing that decides what each answer is worth.
The corresponding test (`src/lib/assessment/scoring.test.ts`,
`describe("Likert scoring (F1 / BRD §4.1)")`) pins the current 0.6
floor explicitly so a behavior change like this lands as an intentional
test update rather than a silent regression.

### See also

- F1 implementation commit: `feat(assessment): add Likert question type
  (F1 / BRD §4.1)` (e94023b).
- Existing maturity-scale (0–3) and yes/no semantics live in
  `src/lib/assessment/scoring.ts:normalizeAnswerToMaturity` and are
  unchanged by F1.
