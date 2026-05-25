# Epic 5.6 — Account Security, Consent & Compliance

**Status:** **Mostly implemented** (MFA, RBAC, PII policy/consent, encryption, audit, cron auth)  
**Scope:** Authentication strength, access control, personal-data consent, encryption at rest, audit trail (cross-cutting; relates to BRD §3.5 / §5.1)

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-47 | Enrol in MFA | **Done** | Advisor/admin only; not clients (magic-link auth) |
| US-48 | Sign in with MFA & recovery codes | **Done** | Workspace pages, APIs, role gates until `mfaVerified` |
| US-49 | Enforce RBAC | **Done** | Role helpers, soft-delete sign-out, super-admin gates |
| US-50 | Configure PII disclosure policy (advisor) | **Done** | `/advisor/settings/pii-policy` |
| US-51 | Capture client PII consent | **Done** | `/consent/pending`, `consent-decision-actions` |
| US-52 | Protect sensitive data at rest | **Done** | App-layer encryption (MFA secrets, answers, PII, email) |
| US-53 | Tamper-evident audit trail | **Done** | `writeAudit`, retention sweep cron |
| US-54 | Secure scheduled jobs | **Done** | `CRON_SECRET` bearer on all `/api/cron/*` routes |

---

## US-47 — Enrol in Multi-Factor Authentication

**Eligible roles:** `ADVISOR`, `ADMIN`, `SUPER_ADMIN` only.

Clients (`role = USER`) authenticate via **magic link** ([Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md) US-6). They do not use passwords or MFA — email inbox possession is the sole sign-in factor. MFA APIs return **403** for client sessions; the Settings MFA card is hidden for clients.

| Capability | Implementation |
|------------|----------------|
| MFA setup (QR + manual secret; not active until verify) | `/settings` → `/mfa/setup`, `enrollMFA()` |
| Activate with valid 6-digit TOTP | `/api/auth/mfa/verify` (`action: "enable"`) |
| 10 single-use recovery codes, shown once | `enableMFA()` + setup UI |
| Block re-enrollment when already enabled | Enroll API **409**; setup page redirect |

**Code:** `src/lib/mfa.ts`, `src/app/api/auth/mfa/**`, `src/app/(auth)/mfa/setup/**`  
**Test credentials:** `advisor@test.com` / `testpassword123` (see CLAUDE.md)

---

## US-48 — Sign In with MFA and Recovery Codes

Applies to **advisor/admin** credential sign-in only (clients use magic link; no MFA).

| Acceptance criterion | Implementation |
|---------------------|----------------|
| MFA enabled → session not fully authorized until valid 6-digit TOTP | On sign-in, `Session.mfaVerified=false` when `mfaEnabled`; JWT mirrors DB; `(protected)/layout` + `proxy.ts` redirect workspace pages; **API routes** return **403** until verified; `requireAdvisorRole` / `requireAdminRole` throw |
| ±1 TOTP period drift | `verifyMFAToken()` `epochTolerance: 60` (±30s) |
| Valid recovery code signs in; code single-use | `/api/auth/mfa/recovery`, `verifyRecoveryCode()` removes hash; `markSessionMfaVerified()`; audit `AUTH_MFA_RECOVERY_USED` |

**Code:** `src/lib/auth/mfa-gate.ts`, `src/lib/auth/require-mfa-verified.ts`, `src/proxy.ts`, `src/app/(auth)/mfa/verify/*`, `src/lib/mfa.ts`

**Tests:** `mfa-gate.test.ts`, `mfa-recovery.test.ts`, `mfa-session.test.ts`, `mfa.test.ts` (TOTP drift)

**Post-verify navigation:** full `window.location.assign` after TOTP/recovery so the session cookie/JWT refresh matches credentials sign-in behavior.

**Exempt while challenge pending:** `/api/auth/*` (including `mfa/verify` + `mfa/recovery`), `/mfa/verify`, cron/webhooks.

---

## US-49 — Enforce Role-Based Access Control

| Acceptance criterion | Implementation | Tests |
|---------------------|----------------|-------|
| Wrong role → protected page/API denied | `requireAdminRole`, `requireAdvisorRole`, `requireSuperAdminRole`; `/admin` + `/advisor` layouts; client API ownership checks | `tests/smoke/auth-edge-cases.spec.ts`, `tests/smoke/epic-5.5-platform-admin.spec.ts` |
| Unknown/missing role → `USER` | `normalizeUserRoleString()` in session callback + role helpers | `src/lib/auth-roles.test.ts` |
| Soft-deleted account → signed out | `auth.config.ts` sign-in block; `(protected)/layout` DB check; `proxy.ts` `accountDeactivated`; advisor hub `deactivated` path | `tests/smoke/epic-5.6-rbac.spec.ts` |
| Platform settings/thresholds → super-admin only | `requireSuperAdminRole()` on thresholds, integrations, staff provisioning, feature-flag actions | `tests/smoke/epic-5.5-platform-admin.spec.ts` (US-41, US-42) |

**Code:** `src/lib/auth-roles.ts`, `src/lib/admin/auth.ts`, `src/lib/advisor/auth.ts`, `src/proxy.ts`, `src/app/(protected)/admin/layout.tsx`, `src/app/(protected)/advisor/layout.tsx`

**Test fixture API:** `POST /api/test/user/deactivate` (`restoreOnly: true` to reset) — requires `ENABLE_TEST_AUTH=1`; `*@test.com` emails only.

---

## US-50 — Configure the PII Disclosure Policy (Advisor)

| Capability | Implementation |
|------------|----------------|
| Default opt-out (all fields enabled) | `DEFAULT_PII_POLICY` |
| Disabled field never visible to advisor | Policy + `fieldVisibility` enforcement |
| Policy changes audit-logged | `updatePiiPolicy()` → `PII_POLICY_*` audit rows |

**Code:** `src/lib/advisor/pii-policy.ts`, `src/lib/actions/pii-policy-actions.ts`

---

## US-51 — Capture Client PII Consent

| Capability | Implementation |
|------------|----------------|
| Omitted field defaults to No | `recordConsentDecision()` |
| Yes/No both audit-logged | `CLIENT_PII_INTAKE_CONSENT` |
| Advisor-disabled field stays hidden | Filtered from consent form + forced false |
| Unchanged value → no duplicate audit | Idempotency on prior `fieldVisibility` |

**Code:** `src/lib/actions/consent-decision-actions.ts`, `src/components/consent/ConsentDecisionForm.tsx`

---

## US-52 — Protect Sensitive Data at Rest

| Capability | Implementation |
|------------|----------------|
| MFA secrets, answers, transcriptions, PII encrypted | `src/lib/encryption.ts`, `response-content.ts`, `client-pii.ts` |
| Email: deterministic encryption for lookup | `encryptDeterministic`, `User.emailCiphertext` |
| Plaintext + ciphertext coexist during migration | `isCiphertext()`, `safeDecrypt*` |

**Docs:** [operations/s3-sse-kms.md](../operations/s3-sse-kms.md) for S3 blobs

---

## US-53 — Maintain a Tamper-Evident Audit Trail

| Capability | Implementation |
|------------|----------------|
| Actor, role, action, entity, redacted before/after, email hash | `writeAudit()`, `redactForAudit()` |
| Audit failure does not break action | `writeAudit` catch + log |
| 365-day retention sweep + self-audit | `/api/cron/audit-log-retention`, `runAuditLogRetentionSweep()` |

Admin audit UI: [Epic 5.5](./EPIC-5.5-platform-administration.md) US-34.

---

## US-54 — Secure Scheduled Jobs

| Capability | Implementation |
|------------|----------------|
| Invalid/missing bearer → 401 | All four `/api/cron/*` routes |
| No `CRON_SECRET` → 500 (fail closed) | Same pattern |
| Valid secret → job runs | `timingSafeEqual` comparison |

---

## Playwright coverage

| Area | Status |
|------|--------|
| MFA sign-in (unit) | **Implemented** — gate helpers, recovery reuse, TOTP drift |
| MFA sign-in (E2E) | **Implemented** — `tests/smoke/epic-5.6-mfa-sign-in.spec.ts` (TOTP gate, API 403, recovery reuse) |
| RBAC / soft-delete (unit) | **Implemented** — `src/lib/auth-roles.test.ts`, `mfa-session-status.test.ts` |
| RBAC / soft-delete (E2E) | **Implemented** — `tests/smoke/auth-edge-cases.spec.ts`, `epic-5.5-platform-admin.spec.ts`, `epic-5.6-rbac.spec.ts` |
| Consent gate | **Not implemented** |
| Cron auth smoke | Partial (`epic-5.4-documents-cron-sse.spec.ts`) |

## Related

- [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md) — client magic-link auth (no MFA)
- [Epic 5.5](./EPIC-5.5-platform-administration.md) — audit log UI, admin RBAC
