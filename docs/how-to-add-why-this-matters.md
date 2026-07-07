# Adding "Why this matters" to assessment questions

**What it is:** A short note under an assessment question that tells the client
*why* we're asking. It appears automatically on the client's screen for the 6
assessment domains — but only when the text has been filled in. Blank questions
simply don't show the note.

**Who can do this:** Anyone with **Admin** access to the platform. It's edited in
the platform question bank, so an advisor-only login won't see this screen.

**Where clients see it:** Directly beneath the question, styled as a small "Why
this matters" callout, as they take the assessment. It does **not** change the
client's answer or their score.

## Steps

1. Sign in with your **Admin** account.
2. Go to **Admin → Assessment Management → Questions** (choose a risk domain,
   e.g. Governance, Cyber, Physical).
3. Click the question you want to update.
4. Find the box labeled **"Why this matters."**
5. Type a short, plain-language explanation (see tips below).
6. Click **Save.** That's it — it goes live for clients on that question.
7. Repeat for each question that's currently blank.

> There's also an optional **"Additional context"** box just below. Anything you
> put there is shown together with the "Why this matters" note — use it only if a
> question needs a little extra explanation.

## Tips for good copy

- **Keep it to 1–2 sentences.** It's a nudge, not a paragraph.
- **Answer "why should I care?"** — connect the question to the client's
  protection, not to our process.
  - ✅ *"Knowing where your properties are helps us flag location-specific risks
    like flooding, wildfire, or crime trends."*
  - 🚫 *"This question is part of the physical risk module."*
- **Plain language, no jargon.** Write like you'd explain it to the client
  face-to-face.
- **Stay neutral.** It shouldn't hint at a "right" answer.

## Good to know

- Changes take effect **immediately** after saving — no deploy needed.
- This is for the **6 assessment domains.** (Intake questions have their own
  internal "why this matters," but that one is a staff note and isn't shown to
  clients.)
- If you save text and it doesn't appear, double-check you edited the question in
  the **domain the client is actually taking**, then refresh.

## For reference (technical)

The **"Why this matters"** field in the admin question bank editor
(`/admin/assessment/questions/[riskAreaId]`) saves to the question's
`whyThisMatters` value, which is rendered to the client on the assessment
question screen (`QuestionCard`). No code or deploy is required to publish copy —
saving in the admin editor is enough.
