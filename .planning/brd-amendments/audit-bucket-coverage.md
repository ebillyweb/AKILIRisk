# BRD §5.4 audit-bucket coverage spot-check

Round-12 verification item. BRD §5.4 calls for "Full audit logs:
**User activity**, **Data access**, **Changes to configurations**."
This file walks every entry in `AUDIT_ACTIONS`
(`src/lib/audit/audit-log.ts`) and maps it to one or more of those
three categories. Several actions land in multiple buckets — admin
mutations to user accounts are simultaneously "user activity" (the user
record changed) and "configuration change" (the platform's user roster
is configuration).

The file is informational. No code changes; no behavior changes.
Companion to `round-11-pii-scope.md`.

## Mapping

Legend: **U** = User activity, **D** = Data access, **C** = Configuration change. Comma-separated when multiple.

### Admin actions on User accounts (P2)

| Constant | Buckets | Note |
|---|---|---|
| `USER_CREATE` | U, C | Admin provisions an account; both a user-activity event AND a roster change. |
| `USER_UPDATE` | U, C | Admin edits a user (role, name, etc.). |
| `USER_SOFT_DELETE` | U, C | Admin disables an account. |
| `USER_RESTORE` | U, C | Admin un-soft-deletes. |
| `USER_PORTAL_ACCESS_TOGGLE` | U, C | Advisor portal kill switch flip. |

### Admin actions on configuration (P2)

| Constant | Buckets | Note |
|---|---|---|
| `PLATFORM_SETTINGS_UPDATE` | C | Generic settings catch-all. |
| `RISK_THRESHOLDS_UPDATE` | C | Admin moves Low/Medium/High score cutoffs. |
| `GOVERNANCE_LEAD_ASSIGN` | C | Assignment of a governance reviewer. |
| `INTAKE_QUESTION_UPDATE` | C | Edits intake question copy. |
| `INTAKE_QUESTION_VISIBILITY_TOGGLE` | C | Hides/shows an intake question. |
| `BANK_QUESTION_CREATE` | C | New scored question added to the bank. |
| `BANK_QUESTION_UPDATE` | C | Edit existing bank question. |
| `BANK_QUESTION_DELETE` | C | Hard delete of a bank question. |
| `BANK_QUESTION_VISIBILITY_TOGGLE` | C | Soft-hide of a bank question. |
| `BANK_QUESTION_REORDER` | C | Bulk re-prioritization. |
| `PILLAR_QUESTION_UPDATE` | C | Edit pillar-question (post-DDL bank) copy. |
| `PILLAR_QUESTION_DELETE` | C | Hard delete (post-DDL). |
| `PILLAR_QUESTION_VISIBILITY_TOGGLE` | C | Soft-hide (post-DDL). |

### Service-recommendation catalog + matching rules (C1, BRD §4.4)

| Constant | Buckets | Note |
|---|---|---|
| `RECOMMENDATION_CREATE` | C | New ServiceRecommendation row. |
| `RECOMMENDATION_UPDATE` | C | Edit existing service recommendation. |
| `RECOMMENDATION_DELETE` | C | Hard delete (only when no FK refs). |
| `RECOMMENDATION_VISIBILITY_TOGGLE` | C | Soft delete equivalent. |
| `RECOMMENDATION_RULE_CREATE` | C | Matching rule provisioned. |
| `RECOMMENDATION_RULE_UPDATE` | C | Matching rule edited. |
| `RECOMMENDATION_RULE_DELETE` | C | Matching rule removed. |
| `RECOMMENDATION_RULE_VISIBILITY_TOGGLE` | C | Soft-hide of a rule. |
| `RECOMMENDATION_RULE_REORDER` | C | Bulk priority change. |

### Scoring rules + assessment rescore (C2, BRD §7.2)

| Constant | Buckets | Note |
|---|---|---|
| `SCORING_RULE_CREATE` | C | Reserved (no live write paths today). |
| `SCORING_RULE_UPDATE` | C | Reserved. |
| `SCORING_RULE_DELETE` | C | Reserved. |
| `SCORING_RULE_VISIBILITY_TOGGLE` | C | Reserved. |
| `ASSESSMENT_RESCORE` | U, C | Admin re-runs scoring; affects the client's data (U) under current rules (C). |

### Auth events (P3)

| Constant | Buckets | Note |
|---|---|---|
| `AUTH_SIGNIN_SUCCESS` | U | Advisor / admin sign-in. |
| `AUTH_SIGNIN_FAILURE` | U | Failed credentials. |
| `AUTH_REGISTER` | U | Self-service signup (advisors via invite; clients no longer use this path post-round-11). |
| `AUTH_PASSWORD_RESET_REQUESTED` | U | Reset-link issuance. |
| `AUTH_PASSWORD_RESET_COMPLETED` | U | Reset-link consumption. |
| `AUTH_MFA_ENROLLED` | U | TOTP secret bound to user. |
| `AUTH_MFA_CHALLENGE_SUCCESS` | U | Second-factor accepted. |
| `AUTH_MFA_CHALLENGE_FAILURE` | U | Second-factor rejected. |
| `AUTH_MFA_RECOVERY_USED` | U | Recovery code consumed. |
| `AUTH_MAGIC_LINK_REQUEST` | U | Client magic-link issuance attempt. |
| `AUTH_MAGIC_LINK_SUCCESS` | U | Client magic-link consumed → session. |
| `AUTH_MAGIC_LINK_FAILURE` | U | Magic-link rejected (expired/used/etc.). |
| `CLIENT_EMAIL_REASSIGN` | U, C | Advisor changes a client's email — both a user-record change (U) and a roster mutation (C). |
| `CLIENT_MAGIC_LINK_REISSUE` | U | Advisor re-issues a client magic link. |

### Advisor workflow actions (P4)

| Constant | Buckets | Note |
|---|---|---|
| `INTAKE_REVIEW_STARTED` | U | Advisor opens an intake for review. |
| `INTAKE_APPROVE` | U, C | Approval changes the client's workflow state (C-shaped). |
| `INTAKE_REJECT` | U, C | Same shape. |
| `INTAKE_WAIVER_SET` | U, C | Advisor waives intake for a client. |
| `DOCUMENT_REQUIREMENT_CREATE` | C | Document checklist mutation. |
| `DOCUMENT_REQUIREMENT_DELETE` | C | Same. |
| `INVITE_SEND` | U | Advisor invites a client. |
| `INVITE_RESEND` | U | Advisor resends an invite. |
| `INVITE_EXPIRE` | U | Invite-code lifecycle (system or admin-driven). |

### Client workflow actions (P4)

| Constant | Buckets | Note |
|---|---|---|
| `HOUSEHOLD_MEMBER_CREATE` | U | Client adds a household member. |
| `HOUSEHOLD_MEMBER_UPDATE` | U | Client edits a household member. |
| `HOUSEHOLD_MEMBER_DELETE` | U | Client removes a household member. |
| `HOUSEHOLD_MEMBER_SHARE_TOGGLE` | U, C | Sharing flag is a privacy-config knob (C). |
| `INTAKE_SUBMIT` | U | Client submits intake for advisor review. |
| `INTAKE_AUDIO_UPLOAD` | U, D | Audio bytes hit S3 — both a user activity AND data persisted. |

### Sensitive data-access reads (P5)

| Constant | Buckets | Note |
|---|---|---|
| `DATA_ACCESS_ADMIN_CLIENTS_LIST` | D | Admin lists every client. |
| `DATA_ACCESS_ADMIN_INTAKE_LIST` | D | Admin lists intake interviews. |
| `DATA_ACCESS_ADMIN_ASSESSMENTS_LIST` | D | Admin lists assessments. |
| `DATA_ACCESS_AUDIO_STREAM` | D | Admin/advisor streams an intake audio response. |
| `DATA_ACCESS_AUDIT_LOG_VIEW` | D | Admin reads the audit log itself (recursive coverage). |
| `DATA_ACCESS_EXPORT` | D | Bulk data export. |

### Reporting Engine (§4.5)

| Constant | Buckets | Note |
|---|---|---|
| `REPORT_DOWNLOAD` | D | Owner / advisor / admin downloads a PDF. |
| `REPORT_PUBLISH` | U, C | Advisor publishes a Report (workflow event + frozen-config snapshot). |
| `REPORT_REPUBLISH` | C | Admin-only fix-up; supersedes a frozen Report after a scoring fix. |
| `REPORT_BACKFILL` | C | One-shot synthetic publish for legacy assessments. |
| `REPORT_BACKFILL_SUMMARY` | C | Sweep summary row. |

### System actions (P1)

| Constant | Buckets | Note |
|---|---|---|
| `SYSTEM_RETENTION_SWEEP` | C | Audit-log retention cron. Configuration-shaped (it deletes per the configured retention window). |
| `SYSTEM_MAGIC_LINK_PRUNE` | C | MagicLinkToken sweep cron. |

## Bucket totals

73 distinct constants. Many fall in multiple buckets (counted once per bucket; total below exceeds 73).

- **User activity (U)**: 33 actions covered.
  Includes all auth events, all advisor-workflow events, all client-workflow events, admin user-account mutations, ASSESSMENT_RESCORE.
- **Data access (D)**: 8 actions covered.
  All of P5, plus REPORT_DOWNLOAD and the audio-upload's data-side.
- **Configuration changes (C)**: 41 actions covered.
  Every P2 config, all of C1 + C2 (recommendations, rules, scoring), advisor approvals/waivers, document-requirement mutations, REPORT_PUBLISH/REPUBLISH/BACKFILL, SYSTEM_RETENTION_SWEEP, SYSTEM_MAGIC_LINK_PRUNE.

Each of the three §5.4 buckets has at least 8 distinct audited
actions; the smallest is "Data access" at 8, which is appropriate for
a platform whose primary read surface is admin-only.

## Gaps flagged (informational — do NOT add audit rows in this commit)

Not all are equal weight. Splitting by likely importance.

### Likely-significant gaps

1. **Client-side dashboard / results reads.** A client viewing
   `/dashboard` or `/assessment/results` does not produce a
   data-access audit row. The advisor-side equivalents
   (`/admin/clients/[id]`, `/admin/assessment`) DO audit. BRD §5.4
   "Data access" arguably implies clients reading their own data
   too — though one could argue a self-read isn't an access event
   worth auditing. Worth a sign-off.
2. **Edit-Draft saves on Reports (§4.5 commit 3).** `saveDraftEdits`
   intentionally does not audit per-save — the publish row's
   `afterData` aggregates the final state. If product wants per-save
   visibility (e.g., "advisor edited the executive summary 14 times
   before publishing v3"), add a `REPORT_DRAFT_SAVE` action. Design
   intent was to avoid log-spam.
3. **Advisor branding mutations.** These are audited via a separate
   `AdvisorBrandingAuditLog` table (round-9), not via `AUDIT_ACTIONS`.
   Two parallel audit substrates. Consolidating would be a small
   migration; cross-bucket queries across both substrates today
   require a UNION.
4. **Subdomain lifecycle.** Advisor subdomain claim/verify/disable
   does not produce `AUDIT_ACTIONS` rows. Some signal lives in
   `AdvisorBrandingAuditLog` if claims are surfaced as branding
   events; otherwise the `AdvisorSubdomain.dnsVerified` flip is
   currently silent.
5. **Stripe webhook events.** `WebhookProcessStatus` lifecycle (the
   `Subscription` model's webhook claim → process → complete) is
   captured on the row itself but not in `AUDIT_ACTIONS`. The
   `processedAt` / `processStatus` columns serve as a per-row audit;
   no constant exists for cross-row queries like "show me every
   webhook from January."

### Likely-minor / arguable gaps

6. **Per-question intake-response writes.** Each individual response
   write is not audited. `INTAKE_SUBMIT` is the only intake-side
   action — the per-question writes inherit auditability via the
   submit event's snapshot. Acceptable.
7. **Per-question assessment-response writes.** Same shape as #6.
   `ASSESSMENT_RESCORE` plus the assessment's `version` field
   provide before/after; no per-keystroke trail.
8. **Session expiration / sign-out.** There is no
   `AUTH_SIGNOUT` constant. NextAuth handles signout client-side
   without server-state mutation, so there's nothing meaningful to
   audit anyway.
9. **Scheduled-task / cron registration.** `SYSTEM_RETENTION_SWEEP`
   + `SYSTEM_MAGIC_LINK_PRUNE` audit each run; the configuration of
   when those crons fire (Vercel Cron settings) is outside the
   platform's audit substrate.
10. **Profile page edits.** Client and advisor profile self-edits
    (name, contact, etc.) — most of those columns were dropped in
    round-11's PII-minimization pass, so the gap is largely
    cauterized. Anything that remains (e.g., advisor's `firmName`)
    edits via the branding flow and is captured by
    `AdvisorBrandingAuditLog`.

## Verdict

Coverage of the three BRD §5.4 buckets is **substantively complete**
for round-12. Each bucket is populated by a healthy mix of
mutation-event constants. The five "likely-significant gaps" above are
each a 1-2-line addition (constant + call site) when the relevant
sign-off arrives — none are blockers. Recommend documenting the
gaps + revisiting in a future round rather than blanket-adding now.
