# FR-6 Extended Deliverables — BRD vs Repo Reconciliation

**FR-6** covers document outputs beyond the main risk report: per-pillar policy documents and tenant data exports. Some BRD epics use numbers **5.8 / 5.9 / 5.10** that **do not match** the epic index in this repo. Use this page when reading an external BRD or test plan.

## Epic number mapping

| BRD epic (external) | BRD focus | Repo epic doc | Repo story IDs (examples) |
|-------------------|-----------|---------------|---------------------------|
| **5.8** | Per-pillar policy Word/PDF (advisor + client) | [EPIC-5.8](./EPIC-5.8-policy-templates-deliverables.md) | US-43 – US-44 (internal); **US-62 – US-63** (BRD advisor policies) |
| **5.9** | Tenant data bundle export (admin) | [EPIC-5.5](./EPIC-5.5-platform-administration.md) § US-64 | **US-64** — not a separate repo epic file |
| **5.10** | Platform continuity (question bank + pillar IDs) | This doc § US-65 – US-66; parallel UI in [EPIC-5.9](./EPIC-5.9-extended-risk-modules.md) | **US-65**, **US-66** vs repo **5.9** = legacy **modules** |

**Do not confuse** BRD **5.10** (pillar aliases, bank fallback) with repo **[Epic 5.9](./EPIC-5.9-extended-risk-modules.md)** (legacy advisor cyber/identity/intelligence **dashboards**). Different scope entirely.

## What is product vs technical debt

| Story | Type | Verdict |
|-------|------|---------|
| US-62 / US-63 | Product | Per-pillar policies — [EPIC-5.8](./EPIC-5.8-policy-templates-deliverables.md) |
| US-64 | Product (compliance) | Tenant ZIP export — implemented; sign-off + optional E2E |
| US-66 | Compatibility shim | **Keep** — `src/lib/assessment/pillar-registry.ts` |
| US-65 | Requirements drift | BRD describes removed `AssessmentBankQuestion` fallback; see below |
| Repo 5.9 (US-45–47) | Legacy surfaces | Reconcile or retire parallel advisor modules |

---

## US-64 — Export a tenant data bundle (admin)

**Repo home:** [Epic 5.5](./EPIC-5.5-platform-administration.md) (extra capability; maps to BRD US-64).

| Acceptance criterion | Status | Implementation |
|---------------------|--------|----------------|
| Bundle scoped to one tenant’s client assignments | **Done** | `resolveTenantScope` + `fetchTenantBundle` — all client rows via `ClientAdvisorAssignment` (`src/lib/export/queries.ts`; cross-tenant leak test in `queries.test.ts`) |
| Non-admin → not found (not forbidden) | **Done** | `GET /api/admin/exports` → **404** when `getAuditAdminActorOrNull()` fails |
| Audit before stream; size cap | **Done** | `writeAudit` (`DATA_ACCESS_EXPORT`) before ZIP stream; `EXPORT_BYTE_CAP` (50 MB) in `composeTenantZip` |

**UI:** `/admin/exports` (super-admin). **API:** `GET /api/admin/exports?scope=tenant&advisorProfileId=...` or `scope=system`.

**Playwright:** Not in `tests/INVENTORY.md` yet — add smoke if BRD sign-off requires it.

**Not the same as:** Epic 5.8 policy template download (`/api/templates/[id]`).

---

## US-65 — Fall back to the legacy question bank (system)

| Acceptance criterion | BRD text | Repo reality |
|---------------------|----------|--------------|
| Pillar bank has no rows → serve legacy assessment-bank table | Legacy table | **`AssessmentBankQuestion` removed** (migration `20260523140000`). No runtime fallback to that table in `src/`. |
| Override forces legacy bank | Env override | `QUESTION_BANK_FALLBACK_TYPESCRIPT` in `.env.example` / `CLAUDE.md` only — **not referenced in application code**. |
| Pillar bank has rows → pillar bank is source of truth | DDL / `PillarQuestion` | **Done** — `loadGovernanceQuestionsMerged`, `pillar-config.ts`, `isPillarQuestionBankActive()` |

**Canonical ops path:** `npm run seed:pillar-ddl` (or workbook deploy) so `isPillarQuestionBankActive()` is true before assessments run.

**Prescribed reconciliation (pick one):**

1. **Update BRD US-65** to: deploy must seed pillar DDL; empty bank blocks admin mutators and yields no client questions (no silent legacy table).
2. **Re-implement fallback** only if environments without DDL must still run assessments (TypeScript catalog or restored table).

**Status:** **Story drift** — do not treat as blocking policy-template (5.8) work.

---

## US-66 — Resolve legacy pillar identifiers (system)

| Acceptance criterion | Status | Implementation |
|---------------------|--------|----------------|
| `family-governance`, `cyber-risk`, `identity-risk` → current pillars | **Done** | `LEGACY_PILLAR_ALIASES` in `src/lib/assessment/pillar-registry.ts` |
| Current ids unchanged | **Done** | `normalizePillarSlug` / `normalizePillarScoreId` |

**Used by:** score API, pillar-scores API, PDF snapshot builder, policy template pillar lookup (`loadPillarScoreForTemplate`), redirects from `/assessment/family-governance/*`.

**Status:** **Done** — intentional long-lived shim until a DB migration rewrites historical `PillarScore.pillar` values.

---

## Related

- [README](./README.md) — full epic index
- [EPIC-5.8](./EPIC-5.8-policy-templates-deliverables.md) — US-62 / US-63
- [EPIC-5.9](./EPIC-5.9-extended-risk-modules.md) — legacy advisor **modules** (not US-65/66)
- [tests/INVENTORY.md](../../tests/INVENTORY.md) — Playwright status
