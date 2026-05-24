# Epic 5.6 — Account Security, Consent & Compliance

**Status:** **Code-only** → stories US-35–US-38 proposed  
**Scope:** Authentication beyond magic-link invite, MFA, legal consent, encryption, audit (cross-cutting)

## Coverage summary

| Story | Title | Status | Notes |
|-------|--------|--------|--------|
| US-35 | Enable MFA (client) | **Code-only** | TOTP enroll/verify/recovery |
| US-36 | Accept platform consent | **Code-only** | `/consent/pending` gate |
| US-37 | Encrypt sensitive responses | **Code-only** | Answers + transcriptions at rest |
| US-38 | Audit sensitive actions | **Code-only** | Central audit log (see also US-34) |

---

## US-35 — Enable Two-Factor Authentication (Client)

| Capability | Implementation |
|------------|----------------|
| MFA setup in settings | `/settings`, `/mfa/setup` |
| Verify on sign-in | `/mfa/verify`, auth callbacks |
| Recovery codes | `/api/auth/mfa/recovery` |

**Code:** `src/lib/mfa.ts`, `src/app/api/auth/mfa/**`  
**Test fixture:** `client-mfa@test.com` (see CLAUDE.md)

**Reconciliation with Epic 5.1:** Clients primarily use magic-link (US-6); password + MFA is optional/hardening path.

---

## US-36 — Accept Legal Consent Before Use (Client / Advisor)

| Capability | Implementation |
|------------|----------------|
| Pending consent redirect | `/consent/pending`, `pending-consent.ts` |
| Record consent decision | `consent-decision-actions.ts` |

**Code:** `src/lib/advisor/pending-consent.ts`, `src/components/consent/ConsentDecisionForm.tsx`

---

## US-37 — Protect Sensitive Data at Rest (System)

| Capability | Implementation |
|------------|----------------|
| Encrypted assessment answers | `src/lib/encryption.ts` |
| Encrypted intake transcriptions | Field-level encryption on sensitive models |
| Advisor PII policy settings | `/advisor/settings/pii-policy` |

**Docs:** [operations/s3-sse-kms.md](../operations/s3-sse-kms.md) for document/audio storage

---

## US-38 — Record Audit Trail (System)

| Capability | Implementation |
|------------|----------------|
| Structured audit writes | `writeAudit`, `AUDIT_ACTIONS` |
| Covers invites, intake, reports, documents, admin | Used across actions |

**Reconciliation:** US-20 requires download audit; US-38 is the platform-wide pattern. Admin UI in [Epic 5.5](./EPIC-5.5-platform-administration.md) US-34.

---

## Playwright coverage

| Area | Status |
|------|--------|
| MFA flows | **Not implemented** (debug routes exist) |
| Consent gate | **Not implemented** |

## Related

- [Epic 5.1](./EPIC-5.1-client-invitation-onboarding.md) — US-6 magic-link auth
- [Epic 5.5](./EPIC-5.5-platform-administration.md) — audit log UI
