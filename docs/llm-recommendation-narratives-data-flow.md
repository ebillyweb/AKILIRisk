# LLM Recommendation Narratives — Data-Flow One-Pager

**Status:** Prototype (PR #39). Not wired into the runtime. This document exists to
get data-processing sign-off *before* any client data reaches a model in production.

**Owner:** Engineering (recommendation engine) · **Reviewers needed:** Privacy/Legal, Security

---

## 1. What the feature does

A deterministic rules engine **already selects** which remediation services a client is
recommended, based on their assessment scores. The LLM's *only* job is to draft the
**prose** — a short pillar summary, a per-service rationale, and 2–4 next-step bullets —
for services that were already chosen. The model cannot add, drop, rename, or reorder
services (the `serviceId` field is schema-pinned to exactly the selected set).

The model does **not** make risk decisions, compute scores, or select services. If its
output fails validation, it is discarded and the client sees today's static catalog copy
(fail-closed).

## 2. Data flow

```
Client assessment answers (DB, encrypted)
        │
        ▼
Deterministic scoring + rule matching  ── selects services ──┐
        │                                                     │
        ▼                                                     │
Build NarrativeInput  ──►  PII-minimization (see §3/§4)       │
        │                                                     │
        ▼                                                     │
   OpenAI API  (HTTPS, server-to-server, OPENAI_API_KEY)      │
   model: gpt-4o (default), structured JSON output            │
        │                                                     │
        ▼                                                     │
Grounding validator (fail-closed) ──► reject ──► static copy ─┤
        │ pass                                                │
        ▼                                                     ▼
Store narrative on the recommendation ──────────────► shown to advisor/client
```

Egress is **server-side only** (Next.js server → OpenAI API). No browser ever calls the
model, and no key is exposed client-side.

## 3. Exactly what leaves the system

The payload is built by `renderNarrativeUserMessage()` in
`src/lib/assessment/recommendations/llm-narrative/shape-a-prompt.ts`. It sends **only**
these fields:

| Field | Example | Sensitivity | Why it's sent |
|---|---|---|---|
| `pillar.slug` / `name` | `ai-emerging-tech` / "AI & Emerging Tech Risk" | Low | Names the risk domain being written about |
| `pillar.score` / `riskLevel` | `0.7` / `critical` | Low | Sets tone/severity of the summary |
| `household.size` | `5` | Low–moderate | Tailors phrasing ("your household of five") |
| `household.hasOperatingBusiness` | `true` | Low–moderate | Relevant to some rationales |
| `household.travelsInternationally` | `false` | Low–moderate | Contextual only |
| `weakFindings[].questionNumber` | `10.1` | Low | Citation/audit anchor |
| `weakFindings[].questionText` | "Are wire-transfer requests verified out-of-band…" | Low | The question the client answered weakly |
| `weakFindings[].chosenLevel` + `chosenLabel` | `0 — No verification` | **Moderate** | The client's actual answer — source of specificity |
| `weakFindings[].maturityAnchors` | ["No verification", … "enforced and tested"] | Low | Shows the model what "good" looks like |
| `selectedServices[].serviceId/name/description` | `ai_impersonation_defense` … | Low | The services to write about (catalog copy, not client data) |
| `firm.tone` | "measured" | Low | Advisor voice alignment (tone hint only — no firm name) |

> **Removed by design:** `household.hasMinors` and `firm.name` were dropped from the
> payload. They are no longer in the `NarrativeInput` type, the payload is rebuilt from an
> explicit allowlist so they cannot leak even if a caller passes them, and a unit test
> asserts neither appears in the rendered message.

## 4. What explicitly does NOT leave the system

By construction, the payload carries **no direct identifiers**:

- ❌ No client name, email, phone, or address
- ❌ No account numbers, balances, net worth, or any dollar figures
- ❌ No SSN / government IDs
- ❌ No free-text answers, notes, or uploaded documents
- ❌ No advisor or client user IDs, no assessment/interview IDs
- ❌ No geolocation beyond the boolean "travels internationally"
- ❌ No "household includes minors" flag (`hasMinors` removed) and no advisor firm name
  (`firm.name` removed)

The data sent is the client's **maturity answers** (which control was in place, on a 0–3
ladder) plus non-identifying **household shape** — never who they are.

## 5. Processor and terms (to confirm before launch)

- **Processor:** OpenAI, via the **API platform** (not consumer ChatGPT).
- **Vendor status:** OpenAI is already an active sub-processor for this platform (TTS via
  `gpt-4o-mini-tts`, voice transcription via Whisper). This feature adds a **new data
  category** (assessment answers) to an existing vendor relationship, not a new vendor.
- **To verify against the current OpenAI API DPA / terms** (do not treat as settled):
  1. API inputs/outputs are **not used to train** OpenAI models by default. ✅ confirm still true.
  2. **Retention:** default API retention (abuse-monitoring window) vs. Zero-Data-Retention
     eligibility for this endpoint. Decide whether to request ZDR.
  3. Confirm the existing DPA's data-category and sub-processor scope **covers assessment
     content**, not just audio, or amend it.
  4. Data residency / cross-border transfer terms, if relevant to the client base.

## 6. Safeguards already built

- **PII-minimization at the source** — the input type (`NarrativeInput`) has no field for
  names/emails/free-text; there is no code path to send them.
- **Schema-pinned output** — `serviceId` enum is set per call to the selected services; the
  model cannot invent a service.
- **Grounding validator, fail-closed** — `validateNarrativeOutput()` rejects hallucinated
  service ids, fabricated figures/percentages/guarantees, unknown citations, and missing
  coverage. On any failure the generation is discarded and static copy is used.
- **No runtime wiring yet** — nothing is sent to any model until this sign-off completes
  and the integration (Phase 3) is built behind a feature flag.
- **Server-side egress only** — no client-side key or call.

## 7. Residual risks / open questions for sign-off

1. ~~**`hasMinors`**~~ — **Resolved:** removed from the payload (no longer in the type;
   allowlist-enforced; test-covered).
2. ~~**`firm.name`**~~ — **Resolved:** removed from the payload; only a `tone` hint is sent.
3. **`household.size`** — the most sensitive field still sent. A small integer, no
   identifiers; assessed low. Confirm acceptable, or coarsen to a band (e.g. 1–2 / 3–5 / 6+)
   if Privacy prefers.
4. **Re-identification** — could household shape + specific weak answers, combined with
   other data, re-identify a client? Assessed as low (no identifiers, coarse buckets), but
   Privacy should confirm the threshold for this client base.
5. **Advisor/client disclosure** — does the client agreement need to disclose that
   AI assists in drafting recommendation copy? Product/Legal call.
6. **Retention decision** — request ZDR, or accept default abuse-monitoring retention?

## 8. Decision requested

- [ ] Privacy/Legal: confirm the field set in §3 is acceptable (esp. §7.3 `household.size`),
      and that the current OpenAI DPA covers this data category (§5).
- [ ] Security: confirm server-side egress + key handling posture.
- [ ] Product: decide on ZDR and on client-facing AI-assist disclosure.

Once §8 is signed off, Phase 3 (wire generation into scoring, behind a flag, fail-closed)
can proceed.
