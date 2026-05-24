# BRD §3.5 amendment — round 13 (household profiles, privacy & advisor control)

> **Header note for the maintainer:** canonical text for a new §3.5
> section and related cross-references. Paste into the Drive BRD when
> convenient; the repo copy is the source of truth until that's done.
>
> **User stories:** [Epic 5.3](../../docs/user-stories/EPIC-5.3-household-profiles-personalization.md)
> (US-21 – US-23 shipped; US-48 – US-49 this round).
>
> **Cross-references:** §3.2 (assessment branching — US-13 answer-based
> vs US-23 profile-based), §5.1 (PII / `shareWithAdvisor` flag definition),
> Option D PII policy (`AdvisorProfile.piiPolicy`, `fieldVisibility`).

---

## §3.5 Household profiles & personalization

### Scope

Household profiles let a **client** describe family composition and
governance roles so the platform can personalize assessment questions,
branch on household structure, and enrich advisor deliverables (PDF
reports, policy templates).

Each client has **exactly one assigned advisor**. Advisors do not share
clients; visibility and feature toggles are evaluated against that
single assignment.

### FR-HH-01 — Manage household members (client)

The client can create, read, update, and delete `HouseholdMember` rows
via `/profiles`.

Each member stores:

| Field | Required | Notes |
|-------|----------|-------|
| `displayLabel` | Server-assigned | Pseudonymous label ("Member A", "Member B", …). Not user-editable. |
| `relationship` | Yes | `FamilyRelationship` enum |
| `governanceRoles` | No (default `[]`) | `GovernanceRole` enum array |
| `isResident` | Yes (default true) | Distinguishes extended family |
| `birthYear` | No | Age derived at read time for branching |
| `sex` | No | Demographic enum |
| `shareWithAdvisor` | Yes (default true) | See FR-HH-03 |
| `fullName`, `phone`, `notes` | No | Optional encrypted PII; gated by §5.1 Option D consent |

CRUD is scoped to the signed-in client (`userId` ownership). Validation
rejects invalid enums and birth years.

### FR-HH-02 — Personalized assessment & profile branching

When household profiles are **enabled** for the client's advisor
(FR-HH-04):

1. **Personalized copy (US-22):** Questions with a `textTemplate`
   render role-aware text (e.g. successor name) using the client's full
   household profile, including members with `shareWithAdvisor = false`.
2. **Profile branching (US-23):** Questions with a `profileCondition`
   show or hide based on household composition (successors, trustees,
   multi-generation households, young dependents). Profile conditions
   evaluate against the client's **full** household profile.
3. **Answer branching (§3.2 / US-13):** Unchanged; both rule types must
   pass for a question to display.

When household profiles are **disabled** (FR-HH-04) or the client has
no members, behavior matches the pre-profile product: static question
text, profile conditions treated as false, answer branching only.

Scoring weights and maturity scales are unaffected by personalization.

### FR-HH-03 — Per-member advisor sharing (`shareWithAdvisor`)

Each `HouseholdMember.shareWithAdvisor` defaults to **true** (including
backfill for existing rows).

The client toggles sharing **per member** on `/profiles` (create/edit).

| Surface | `shareWithAdvisor = true` | `shareWithAdvisor = false` |
|---------|---------------------------|----------------------------|
| Client assessment (US-22, US-23) | Member included | **Member still included** |
| Advisor pipeline / client detail | Member visible (subject to PII consent) | **Member omitted** |
| Published PDF / report snapshot | Member in household section | **Member omitted** |
| Policy templates | Placeholders for member | **Member omitted** |
| Data export (§5.3 portability) | Included in client bundle | Included (client owns data) |

Optional encrypted fields (`fullName`, `phone`, `notes`) on a member
with `shareWithAdvisor = false` are never shown to the advisor regardless
of prior consent flags.

Changes to `shareWithAdvisor` are audit-logged.

### FR-HH-04 — Advisor household-profiles toggle

`AdvisorProfile.householdProfilesEnabled` defaults to **true**.

When an advisor sets it to **false** (tenant-wide; applies to all of
that advisor's clients):

| Behavior | Effect |
|----------|--------|
| Client nav | `/profiles` link hidden; direct URL shows explanatory empty state |
| Intake nudge | Post-intake household prompt suppressed |
| Assessment | Generic question text; profile conditions false |
| Advisor UI | No household composition sections |
| Reports / templates | No household member tables or role placeholders |

Disabling does **not** delete existing `HouseholdMember` rows. Re-enabling
restores client access and personalization.

There is **no per-client override** on `ClientAdvisorAssignment`.

Changes are audit-logged.

### FR-HH-05 — Optional household PII (Option D)

Optional member PII fields remain governed by the existing Option D
stack:

- Advisor `piiPolicy` — which fields future clients may be offered
- Client `fieldVisibility` on assignment — Yes/No consent per field
- Encryption at rest for stored values

`shareWithAdvisor` gates **whether the member row appears at all** on
advisor surfaces; `fieldVisibility` gates **which optional columns**
within a shared member the advisor may decrypt.

---

## §3.2 addendum — branching rule types

Assessment question visibility requires **all** applicable rules to pass:

| Rule type | Source | Evaluated against |
|-----------|--------|-------------------|
| Answer-based | `branchingRule` / bank predicate | Prior question answers (US-13) |
| Profile-based | `profileCondition` / `profileConditionKey` | Client household profile (US-23) |
| Admin hidden | `is_visible` / bank flag | Platform configuration |
| Advisor feature off | `householdProfilesEnabled = false` | Profile conditions → false; templates skipped |

---

## Traceability

| BRD ID | User story | Implementation status |
|--------|------------|----------------------|
| FR-HH-01 | US-21 | Shipped |
| FR-HH-02 | US-22, US-23 | Shipped (partial E2E) |
| FR-HH-03 | US-48 | **This round** |
| FR-HH-04 | US-49 | **This round** |
| FR-HH-05 | Epic 5.6 / US-36–37 | Shipped (consent); wire with US-48 |
