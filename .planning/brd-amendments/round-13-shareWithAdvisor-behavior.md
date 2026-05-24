# BRD §5.1 addendum — round 13 (`shareWithAdvisor` behavior & Option D reconciliation)

> **Header note for the maintainer:** amends
> [round-11-pii-scope.md](./round-11-pii-scope.md). Paste into Drive §5.1
> when convenient. Does not replace round 11 wholesale.

---

## Addendum to §5.1 — Household member visibility

Round 11 introduced `HouseholdMember.shareWithAdvisor` as a control
flag. Round 13 defines its behavior (see also §3.5 FR-HH-03).

### `shareWithAdvisor` semantics

- **Default:** `true` on create; migration backfills existing rows to `true`.
- **Client control:** toggled per member on `/profiles`.
- **Advisor read path:** advisor-facing queries, report snapshots, pipeline
  detail, and template mappers **filter out** members where
  `shareWithAdvisor = false`.
- **Client read path:** assessment personalization, profile branching, and
  the client's own `/profiles` UI **include all members** regardless of
  the flag.
- **Audit:** toggles emit structured audit rows.

This is distinct from Option D **field-level** consent
(`fieldVisibility`): `shareWithAdvisor` controls whether the member
row is visible at all; field consent controls optional encrypted columns
within a visible member.

### Option D optional household PII (reconciliation)

Round 11 stated that `HouseholdMember.fullName`, `phone`, and `notes`
are "NOT stored." **Option D (session 1)** superseded that for advisors
who enable optional fields in `piiPolicy` and clients who consent:

| Column | Storage | Advisor visibility |
|--------|---------|-------------------|
| `displayLabel` | Always | When `shareWithAdvisor = true` |
| Demographics (`birthYear`, `sex`, `relationship`, roles, `isResident`) | Always | When `shareWithAdvisor = true` |
| `fullName`, `phone`, `notes` | Encrypted when provided | Only when `shareWithAdvisor = true` **and** `fieldVisibility` grants the field |

Clients who decline optional PII or set `shareWithAdvisor = false` never
expose those values to the advisor UI.

### §5.1 protection #3 — exports (clarification)

- **Client portability bundle (§5.3):** includes all household members
  the client owns, including `shareWithAdvisor = false` rows (the client
  is the data subject).
- **Advisor-facing exports / audit readouts:** omit members with
  `shareWithAdvisor = false` and redact non-consented optional PII.
