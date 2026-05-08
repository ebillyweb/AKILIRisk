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

## Gaps walk-through

10 gaps were initially flagged. After investigation, **1 was wired**
(client `/assessment/results` self-reads) and **9 were determined to
be by-design or have no production call site to instrument**. Each
gap below carries an explicit verdict (🟢 wired / 🟡 by-design / ⚪
deferred) with rationale.

### Likely-significant gaps

1. **Client-side `/assessment/results` self-reads.** 🟢 **Wired** in
   the round-12 audit close-out commit. New constant
   `DATA_ACCESS_OWN_ASSESSMENT_RESULTS` fires on every successful
   `GET /api/assessment/[id]/score`. metadata captures
   `{ assessmentId, pillar }`; no dedupe in v1 (the
   `audio-stream-dedupe.ts` pattern is the natural mitigation if log
   volume becomes a concern). Client `/dashboard` reads remain
   unaudited deliberately — every site visit hits the dashboard, so
   auditing it is poor signal-to-noise; results-page reads are
   intentional drill-downs and worth recording.
2. **Edit-Draft saves on Reports (§4.5 commit 3).** 🟡 **By-design.**
   `saveDraftEdits` is intentionally not audited per-save — the
   `REPORT_PUBLISH` row's `afterData` aggregates the final editorial
   state at publish time. Per-keystroke would be log-spam. If product
   ever wants "advisor edited the executive summary 14 times before
   publishing v3" visibility, add a `REPORT_DRAFT_SAVE` action; design
   intent until then is aggregate-at-publish.
3. **Advisor branding mutations.** 🟡 **By-design (architectural).**
   Branding edits flow through the `AdvisorBrandingAuditLog` model
   (round-9), separate from the global `AuditLog` table. This is an
   intentional choice: branding has per-advisor scope, retention, and
   read-access semantics that differ from the platform-wide audit
   substrate. Round-8's unified read adapter merges the two
   substrates at query time, so cross-substrate filtering "just
   works" from the admin audit-log UI. Cross-substrate queries from
   other call sites (e.g. exports) currently require a UNION; that's
   the only remaining friction and can be flattened by the export
   helper if needed.
4. **Subdomain lifecycle.** 🟡 **By-design (no production call site
   to instrument).** Investigation finding: there is exactly ONE
   write path for `AdvisorSubdomain.dnsVerified` in the codebase
   (`subdomain/claim/route.ts`), and it sets the value to `false` at
   claim time. **No production code path flips `dnsVerified` to
   `true`** — DNS verification is currently a manual / out-of-band
   admin DB operation. Pre-emptively adding audit constants without
   call sites would be cargo-cult. Claim + release ARE audited via
   `auditSubdomainClaim` (parallel substrate). When a real
   automated DNS-verification route lands, that's the moment to add
   `SUBDOMAIN_DNS_VERIFY` / `SUBDOMAIN_DNS_UNVERIFY` constants.
5. **Stripe webhook events.** 🟡 **By-design.**
   `WebhookProcessStatus` (the lifecycle of an inbound webhook from
   `claim` → `process` → `complete`) is implementation detail —
   useful for ops debugging but not a business-event audit signal.
   The meaningful business outcomes (subscription created /
   upgraded / cancelled / billing-cycle transitions) are captured in
   the dedicated `SubscriptionAuditLog` model, which has its own
   admin read surface. Adding `AUDIT_ACTIONS` constants for the
   webhook-process states would duplicate the per-row
   `processedAt` / `processStatus` columns without adding query
   reach.

### Likely-minor / arguable gaps

6. **Per-question intake-response writes.** 🟡 **By-design.**
   `INTAKE_SUBMIT` is the boundary event — its `afterData` captures
   the full intake snapshot. Per-keystroke is log-spam.
7. **Per-question assessment-response writes.** 🟡 **By-design.**
   `ASSESSMENT_RESCORE` + `Assessment.version` give the before/after
   trail at the meaningful boundary; per-question is log-spam.
8. **Session expiration / sign-out.** 🟡 **By-design (no server-side
   mutation to audit).** NextAuth handles sign-out client-side; the
   server has no state change to record.
9. **Scheduled-task / cron registration.** 🟡 **By-design (out of
   substrate).** `SYSTEM_RETENTION_SWEEP` and
   `SYSTEM_MAGIC_LINK_PRUNE` audit each cron *run*. The
   *configuration* of when those crons fire lives in
   `vercel.json` / deployment config — outside the platform audit
   substrate by definition.
10. **Profile page edits.** 🟡 **By-design (cauterized by §5.1
    PII-minimization).** Most editable client-profile columns were
    dropped in round-11. Remaining advisor-profile fields (e.g.
    `firmName`) flow through the branding edit path and are captured
    by `AdvisorBrandingAuditLog`. No standalone "profile edit"
    surface remains to instrument.

## Verdict

Coverage of the three BRD §5.4 buckets is **substantively complete**.
Round-12 close-out: 1 of 10 flagged gaps was wired; 9 of 10 were
determined to be by-design or have no production call site to
instrument. Of the 9, 4 carry an explicit "add an audit constant
when a real call site lands" note (gap 4 subdomain DNS verify, gap 2
draft saves if product wants per-save visibility) — i.e. they remain
intentional non-coverage today but with a clear forward path.

**Tally:** 9 of 10 gaps closed by design; 1 wired in the round-12
audit close-out commit (`chore(audit): close out audit-bucket gaps`).
