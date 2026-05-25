# User Stories & Epic Index

This directory maps **BRD functional requirements** to **user stories**, **implementation**, and **Playwright coverage**. Use it to reconcile what the product does in code with what is documented.

## BRD → Epic map

| Epic | BRD / scope | Stories | Doc |
|------|-------------|---------|-----|
| **5.1** | FR-1, FR-11 — client invitation & onboarding | US-1 – US-9 | [EPIC-5.1](./EPIC-5.1-client-invitation-onboarding.md) |
| **5.2** | FR-2 – FR-6 — household assessment lifecycle | US-10 – US-20 | [EPIC-5.2](./EPIC-5.2-household-assessment-lifecycle.md) |
| **5.3** | Household profiles, personalization & privacy | US-21 – US-23, US-48 – US-49 | [EPIC-5.3](./EPIC-5.3-household-profiles-personalization.md) |
| **5.4** | Advisor workspace, pipeline & documents (FR-7, §3.4) | US-28 – US-36 | [EPIC-5.4](./EPIC-5.4-advisor-workspace-pipeline.md) — *US-35 here is advisor notifications; 5.6 US-35 is MFA (renumber pending)* |
| **5.5** | Platform administration & configuration | US-37 – US-46 | [EPIC-5.5](./EPIC-5.5-platform-administration.md) |
| **5.6** | Account security, consent & compliance | US-35 – US-38 | [EPIC-5.6](./EPIC-5.6-account-security-compliance.md) |
| **5.7** | Billing, branding & white-label | US-39 – US-42 | [EPIC-5.7](./EPIC-5.7-billing-branding-whitelabel.md) |
| **5.8** | Policy templates (Word/PDF per pillar); FR-6 policies | US-43 – US-44, **US-62 – US-63** | [EPIC-5.8](./EPIC-5.8-policy-templates-deliverables.md) |
| **5.9** | Extended / legacy risk **modules** (advisor dashboards, enhanced API) | US-45 – US-47 | [EPIC-5.9](./EPIC-5.9-extended-risk-modules.md) |

Epics **5.3 – 5.9** were added to document functionality that exists in code but was outside US-1–US-20. Story numbers US-21+ are **proposed** until promoted into the BRD.

### BRD epic numbers that differ from this index

Some BRDs label **FR-6** as three epics (**5.8 / 5.9 / 5.10**) where this repo uses different splits:

| BRD label | Topic | Where documented in repo |
|-----------|--------|---------------------------|
| BRD 5.8 | Per-pillar policies (US-62, US-63) | [EPIC-5.8](./EPIC-5.8-policy-templates-deliverables.md) |
| BRD 5.9 | Tenant data export (US-64) | [EPIC-5.5](./EPIC-5.5-platform-administration.md) — not Epic 5.9 here |
| BRD 5.10 | Question-bank fallback (US-65), pillar aliases (US-66) | [FR-6 reconciliation](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md) |

Full mapping and product-vs-debt notes: **[EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md)**.

## Reconciliation status key

| Status | Meaning |
|--------|---------|
| **Done** | Acceptance criteria met; code and story align |
| **Partial** | Core behavior shipped; gaps or intentional deviations noted |
| **Gap** | Story exists; implementation missing or incorrect |
| **Code-only** | Shipped in codebase; no formal story until epic 5.3+ |
| **Legacy** | Still in repo; superseded or parallel to canonical path — reconcile or retire |
| **Story drift** | Story text should be updated to match reconciled behavior |

## Canonical vs parallel code paths

Some features have more than one implementation. When reconciling docs and tests, prefer the **canonical** path:

| Domain | Canonical (document in epic) | Parallel / legacy (epic 5.9 or retire) |
|--------|------------------------------|----------------------------------------|
| Client assessment UI | Six pillars via `pillar-registry.ts`, `/assessment/[pillarSlug]/[questionIndex]` | `family-governance/*`, `identity-risk/*` redirects |
| Scoring | `POST /api/assessment/[id]/score` + `pillar-config.ts` | `/api/assessment/enhanced/*`, monolithic `questions.ts` catalog |
| Recommendations | Rule engine in score route + `RecommendationRule` DB | GPT routes: `/api/cyber-risk/recommendations`, `/api/identity-risk/recommendations` |
| Client PDF | Published snapshot via `/api/reports/[id]/pdf` + `/availability` | Live draft preview (advisor/admin only) |
| Intake waiver | Invite-time `intakeWaived` + advisor `advisor-intake-waiver-actions` | — |

## Playwright coverage

See [tests/INVENTORY.md](../../tests/INVENTORY.md). Epic **5.1** and **5.2** (hub entry) have smoke tests; full US-10–US-20 E2E (score all pillars → advisor publish → client download) is still open.

## Related docs

- [EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md](./EPIC-FR6-EXTENDED-DELIVERABLES-RECONCILIATION.md) — BRD 5.8/5.9/5.10 vs repo; US-64–US-66
- [ACCESS-LEVELS-BY-ROLE.md](../ACCESS-LEVELS-BY-ROLE.md) — role capabilities
- [white-label-subdomains.md](../white-label-subdomains.md) — tenant hosts (Epic 5.7)
- [.planning/PROJECT.md](../../.planning/PROJECT.md) — milestone history (v1.0–v1.5)
