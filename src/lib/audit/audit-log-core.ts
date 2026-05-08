/**
 * Core audit-log implementation (no `import "server-only"`).
 *
 * CLI scripts (`npx tsx scripts/…`) import this module so they do not pull
 * in the `server-only` package, which throws when loaded outside the Next
 * bundler. Application code should keep importing `@/lib/audit/audit-log`,
 * which re-exports everything from here behind `server-only`.
 */

import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clientIpFromRequest } from "@/lib/request-ip";
import { redactForAudit, shortEmailHash } from "./redact";
import { decryptUserEmail } from "@/lib/auth/user-email-crypto";
import { truncateIpForAudit } from "./ip";

/**
 * Generic audit-log write helper. Backs the BRD §5.4 + §3.1 requirement.
 *
 * Schema decision (see round-7 design doc): hybrid model. New `AuditLog`
 * table is the home for everything wired in this round. The two existing
 * audit tables — SubscriptionAuditLog (typed enum columns, billing-wired)
 * and AdvisorBrandingAuditLog (FK-cascaded to AdvisorProfile) — are kept
 * as-is because their shape argues against migration. New code calls
 * `writeAudit`; old code keeps its existing helpers.
 *
 * Failure mode: writeAudit catches and logs all errors; it never throws.
 * The audit must not break the user-visible action it's documenting.
 *
 * Performance: a single INSERT with no joins. Target < 5ms even with
 * Prisma's overhead. Callers may `await` or fire-and-forget; both are
 * supported. Awaiting gives a stronger ordering guarantee for tests.
 */

/**
 * Action vocabulary. All audit `action` strings must come from here so the
 * full set is greppable and the admin UI's filter dropdown is exhaustive.
 *
 * Format: `<entity>.<verb>`, lowercase, dot-separated.
 *  - `<entity>` is snake_case if multi-word (`bank_question`, not `bankQuestion`).
 *  - `<verb>` is past-tense for terminal events, present for state transitions.
 *
 * When you add an action here, also add it to the admin UI dropdown source
 * in /admin/audit-log (P6).
 */
export const AUDIT_ACTIONS = {
  // ── Admin actions on User accounts (P2) ───────────────────────────────────
  USER_CREATE: "user.create",
  USER_UPDATE: "user.update",
  USER_SOFT_DELETE: "user.soft_delete",
  USER_RESTORE: "user.restore",
  USER_PORTAL_ACCESS_TOGGLE: "user.portal_access_toggle",

  // ── Admin actions on configuration (P2) ───────────────────────────────────
  PLATFORM_SETTINGS_UPDATE: "platform_settings.update",
  /** A2 (BRD §4.2 + §7.1): admin updates Low/Medium/High score cutoffs at
   *  /admin/scoring/thresholds. Distinct from PLATFORM_SETTINGS_UPDATE so
   *  threshold changes are filterable separately in the audit log. */
  RISK_THRESHOLDS_UPDATE: "risk_thresholds.update",
  GOVERNANCE_LEAD_ASSIGN: "governance_lead.assign",
  INTAKE_QUESTION_UPDATE: "intake_question.update",
  INTAKE_QUESTION_VISIBILITY_TOGGLE: "intake_question.visibility_toggle",
  BANK_QUESTION_CREATE: "bank_question.create",
  BANK_QUESTION_UPDATE: "bank_question.update",
  BANK_QUESTION_DELETE: "bank_question.delete",
  BANK_QUESTION_VISIBILITY_TOGGLE: "bank_question.visibility_toggle",
  BANK_QUESTION_REORDER: "bank_question.reorder",
  PILLAR_QUESTION_UPDATE: "pillar_question.update",
  PILLAR_QUESTION_DELETE: "pillar_question.delete",
  PILLAR_QUESTION_VISIBILITY_TOGGLE: "pillar_question.visibility_toggle",

  // ── C1 (BRD §4.4): Service-recommendation catalog + matching rules ──────
  /** Admin creates a ServiceRecommendation row. */
  RECOMMENDATION_CREATE: "recommendation.create",
  /** Admin edits a ServiceRecommendation row. */
  RECOMMENDATION_UPDATE: "recommendation.update",
  /** Admin hard-deletes a ServiceRecommendation row (only when no FK refs
   *  exist; otherwise the action errors and suggests visibility-toggle). */
  RECOMMENDATION_DELETE: "recommendation.delete",
  /** Admin toggles isActive on a ServiceRecommendation (soft-delete equiv). */
  RECOMMENDATION_VISIBILITY_TOGGLE: "recommendation.visibility_toggle",
  /** Admin creates a RecommendationRule row. */
  RECOMMENDATION_RULE_CREATE: "recommendation_rule.create",
  /** Admin edits a RecommendationRule row. */
  RECOMMENDATION_RULE_UPDATE: "recommendation_rule.update",
  /** Admin deletes a RecommendationRule row (no historical FK refs to
   *  block hard delete; rules have no AssessmentRecommendation back-pointer). */
  RECOMMENDATION_RULE_DELETE: "recommendation_rule.delete",
  /** Admin toggles isActive on a RecommendationRule. */
  RECOMMENDATION_RULE_VISIBILITY_TOGGLE: "recommendation_rule.visibility_toggle",
  /** Admin bulk-reorders RecommendationRule.priority. Single audit row;
   *  metadata.orderedIds captures the new sequence. */
  RECOMMENDATION_RULE_REORDER: "recommendation_rule.reorder",

  // ── C2 (BRD §7.2): Scoring rules + assessment rescore ───────────────────
  /** Reserved for the future ScoringRule admin editor (no current write
   *  paths exist; every existing ScoringRule write happens in seed
   *  scripts). Keeping the constants in vocabulary now so when the
   *  editor lands, the audit wiring is consistent with the recommendations
   *  editor's pattern. */
  SCORING_RULE_CREATE: "scoring_rule.create",
  SCORING_RULE_UPDATE: "scoring_rule.update",
  SCORING_RULE_DELETE: "scoring_rule.delete",
  SCORING_RULE_VISIBILITY_TOGGLE: "scoring_rule.visibility_toggle",
  /** Admin re-runs an assessment under the current rules + thresholds.
   *  beforeData captures the prior PillarScore + AssessmentRecommendation
   *  rows; afterData captures the new ones. metadata may include a
   *  free-form `reason` string the admin entered in the UI. */
  ASSESSMENT_RESCORE: "assessment.rescore",

  // ── Auth events (P3) ──────────────────────────────────────────────────────
  AUTH_SIGNIN_SUCCESS: "auth.signin_success",
  AUTH_SIGNIN_FAILURE: "auth.signin_failure",
  AUTH_REGISTER: "auth.register",
  AUTH_PASSWORD_RESET_REQUESTED: "auth.password_reset_requested",
  AUTH_PASSWORD_RESET_COMPLETED: "auth.password_reset_completed",
  AUTH_MFA_ENROLLED: "auth.mfa_enrolled",
  AUTH_MFA_CHALLENGE_SUCCESS: "auth.mfa_challenge_success",
  AUTH_MFA_CHALLENGE_FAILURE: "auth.mfa_challenge_failure",
  AUTH_MFA_RECOVERY_USED: "auth.mfa_recovery_used",
  /** Round-11 commit 2 (BRD §5.1.AUTH): magic-link token issued
   *  (POST /api/auth/magic-link/request). metadata.userExists
   *  distinguishes the enumeration-safe paths so the audit-log reader
   *  can see the issuance attempt without learning whether the email
   *  matched a real account. */
  AUTH_MAGIC_LINK_REQUEST: "auth.magic_link_request",
  /** Round-11 commit 2: magic-link successfully consumed; user signed in. */
  AUTH_MAGIC_LINK_SUCCESS: "auth.magic_link_success",
  /** Round-11 commit 2: magic-link validation rejected. metadata.reason:
   *  "expired" | "used" | "not_found" | "user_inactive" |
   *  "non_client_role_blocked". */
  AUTH_MAGIC_LINK_FAILURE: "auth.magic_link_failure",
  /** Round-11 commit 4 (BRD §5.1.AUTH): advisor reassigns the email on an
   *  assigned client account. beforeData.email + afterData.email capture
   *  the change; the audit redactor hashes both via the email-key rule. */
  CLIENT_EMAIL_REASSIGN: "client.email_reassign",
  /** Round-11 commit 4: advisor re-issues a magic link for an assigned
   *  client. metadata.email captures the destination (hashed by the
   *  redactor); metadata.tokenId references the new MagicLinkToken row. */
  CLIENT_MAGIC_LINK_REISSUE: "client.magic_link_reissue",

  // ── Advisor workflow actions (P4) ─────────────────────────────────────────
  INTAKE_REVIEW_STARTED: "intake.review_started",
  INTAKE_APPROVE: "intake.approve",
  INTAKE_REJECT: "intake.reject",
  INTAKE_WAIVER_SET: "intake.waiver_set",
  DOCUMENT_REQUIREMENT_CREATE: "document_requirement.create",
  DOCUMENT_REQUIREMENT_DELETE: "document_requirement.delete",
  INVITE_SEND: "invite.send",
  INVITE_RESEND: "invite.resend",
  INVITE_EXPIRE: "invite.expire",

  // ── Client workflow actions (P4) ──────────────────────────────────────────
  HOUSEHOLD_MEMBER_CREATE: "household_member.create",
  HOUSEHOLD_MEMBER_UPDATE: "household_member.update",
  HOUSEHOLD_MEMBER_DELETE: "household_member.delete",
  HOUSEHOLD_MEMBER_SHARE_TOGGLE: "household_member.share_toggle",
  INTAKE_SUBMIT: "intake.submit",
  INTAKE_AUDIO_UPLOAD: "intake.audio_upload",

  // ── Sensitive data-access reads (P5) ──────────────────────────────────────
  DATA_ACCESS_ADMIN_CLIENTS_LIST: "data_access.admin_clients_list",
  DATA_ACCESS_ADMIN_INTAKE_LIST: "data_access.admin_intake_list",
  DATA_ACCESS_ADMIN_ASSESSMENTS_LIST: "data_access.admin_assessments_list",
  DATA_ACCESS_AUDIO_STREAM: "data_access.audio_stream",
  DATA_ACCESS_AUDIT_LOG_VIEW: "data_access.audit_log_view",
  DATA_ACCESS_EXPORT: "data_access.export",
  /** §9.1 (BRD): admin opens /admin/analytics. metadata captures the
   *  resolved KPI counts so the audit log gives a coarse "what did
   *  Belvedere see on date X" trail without a separate snapshot table.
   *  Aggregate page only — no per-client identifiers in metadata. */
  DATA_ACCESS_ANALYTICS_VIEW: "data_access.analytics_view",
  /** Round-12 audit-bucket close-out: client (or owner) loads their own
   *  scored assessment via GET /api/assessment/[id]/score. metadata.pillar
   *  records the requested pillar; metadata.assessmentId is duplicated
   *  here for parity with REPORT_DOWNLOAD's metadata shape (entityId
   *  carries the same value but logs are easier to filter when the key
   *  is also in metadata). No dedupe in v1; if volume becomes a problem
   *  the audio-stream-dedupe.ts pattern is the natural mitigation. */
  DATA_ACCESS_OWN_ASSESSMENT_RESULTS: "data_access.own_assessment_results",

  // ── §4.5 commit 2: Reporting Engine ───────────────────────────────────────
  /** Written by GET /api/reports/[id]/pdf on every successful render.
   *  entityId is the Assessment id; metadata.clientUserId is the assessment
   *  owner; metadata.actorRole distinguishes USER (client self-download)
   *  from ADVISOR (assigned-advisor download) from ADMIN. metadata.pillar
   *  records the requested pillar (defaults to the most recently calculated
   *  PillarScore when no `?pillar=` query param is supplied). */
  REPORT_DOWNLOAD: "report.download",

  // ── §4.5 commit 3: Reporting Engine — publish lifecycle ──────────────────
  /** Written inside the publishReport transaction on DRAFT → PUBLISHED.
   *  entityType "Report"; entityId is the newly-published Report id.
   *  beforeData captures the DRAFT row (editorial fields + version);
   *  afterData captures the PUBLISHED row (snapshotData + brandingSnapshot
   *  excluded from log to keep row size manageable — they're available on
   *  the Report row itself). metadata records the supersededReportId
   *  (prior PUBLISHED row whose status flipped to SUPERSEDED in the same
   *  transaction) when applicable. */
  REPORT_PUBLISH: "report.publish",
  /** Admin-only republish: rebuilds the snapshot from current live data,
   *  inherits editorial from the prior PUBLISHED, supersedes the old.
   *  Used after a scoring bug fix when the frozen numbers need to be
   *  refreshed without losing the original record. metadata.reason is
   *  the admin's free-form justification (max 500 chars). */
  REPORT_REPUBLISH: "report.republish",
  /** Written once per assessment by scripts/backfill-reports.ts.
   *  entityId is the Assessment id; metadata.reportId is the newly
   *  inserted PUBLISHED Report row's id. */
  REPORT_BACKFILL: "report.backfill",
  /** One summary row at the end of a backfill run. System actor.
   *  metadata.processed / metadata.skipped / metadata.failed counts. */
  REPORT_BACKFILL_SUMMARY: "report.backfill_summary",

  // ── Option D session 1: advisor-configured PII policy ────────────────────
  /** One row per field whose value flipped false → true on a piiPolicy
   *  save. entityType "AdvisorProfile"; entityId is the advisor profile
   *  id; metadata.field is the eligible field key (e.g.
   *  "ClientProfile.phone"). Coexists with the per-save PII_POLICY_UPDATE
   *  summary row — per-field for forensics, summary for "what was the
   *  policy on date X?" queries. */
  PII_POLICY_FIELD_ENABLE: "pii_policy.field_enable",
  /** One row per field whose value flipped true → false on a piiPolicy
   *  save. Same shape as PII_POLICY_FIELD_ENABLE. */
  PII_POLICY_FIELD_DISABLE: "pii_policy.field_disable",
  /** One summary row per piiPolicy save, capturing the full before/after
   *  policy JSON in beforeData/afterData. Coexists with the per-field
   *  ENABLE/DISABLE rows. Idempotent: a save that doesn't change any
   *  field emits no audit rows at all (action returns early). */
  PII_POLICY_UPDATE: "pii_policy.update",

  // ── System actions (P1) ───────────────────────────────────────────────────
  /** Written by /api/cron/audit-log-retention each successful sweep. */
  SYSTEM_RETENTION_SWEEP: "system.retention_sweep",
  /** Round-11 cleanup (NIT 4): /api/cron/magic-link-prune sweeps used
   *  + 7-day-expired MagicLinkToken rows. metadata records the
   *  deleted row count so admins can monitor the table size over
   *  time. */
  SYSTEM_MAGIC_LINK_PRUNE: "system.magic_link_prune",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

const USER_AGENT_MAX_LENGTH = 256;

/**
 * Actor identification passed to writeAudit. `null`/`undefined` actor info
 * is supported for system actions.
 *
 * Round-11 commit 2.4a (BRD §5.1.AUTH / phase B — soft-drop step 1):
 * actors can identify their email two ways. Most call sites pass
 * `email` (plaintext from the form input or `session.user.email`,
 * which NextAuth populates with form-input plaintext after 2.4a).
 * Sites that have a User row in hand and don't want to depend on the
 * (soon-to-be-dropped) plaintext column pass `emailCiphertext`
 * instead — writeAudit decrypts internally to compute the hash. Pass
 * exactly one; if both are passed, ciphertext wins.
 */
export interface AuditActor {
  userId: string | null;
  /** Session role string. Accepted as `string` so callers can pass
   *  `session.user.role` (typed `string | undefined` by NextAuth) without
   *  a cast at every call site. The value is narrowed to `UserRole` at the
   *  Prisma boundary inside `writeAudit`. */
  role?: string | null;
  /** Plaintext email — hashed at write time, never stored. */
  email?: string | null;
  /** Deterministic ciphertext — decrypted then hashed at write time.
   *  Used by call sites that read the User row and don't want to
   *  depend on the plaintext column (which the bake window leaves in
   *  place but will drop in commit 2.4b). */
  emailCiphertext?: string | null;
}

export interface WriteAuditInput {
  /** Actor info. Use `{ userId: null }` for system actions. */
  actor: AuditActor;
  /** One of AUDIT_ACTIONS. */
  action: AuditAction;
  /** Entity type the action targets, e.g. "User", "AssessmentBankQuestion". */
  entityType: string;
  /** The targeted row's id, or null for bulk/aggregate actions. */
  entityId?: string | null;
  /** State before the change. Null for create-events and read-events. */
  beforeData?: unknown;
  /** State after the change. Null for delete-events and read-events. */
  afterData?: unknown;
  /** Free-form context (stripe event id, dedupe window key, row count, etc.). */
  metadata?: Record<string, unknown>;
  /** If supplied, ipAddress + userAgent are extracted and truncated. */
  request?: Request | { headers: Headers } | null;
}

/**
 * Persist one audit-log row.
 *
 * Errors are caught and logged via console.error but never re-thrown — audit
 * failures must not break the action being audited. Caller can `await` for
 * test ordering guarantees; production code can fire-and-forget if the
 * ordering relative to the response isn't important.
 */
export async function writeAudit(input: WriteAuditInput): Promise<void> {
  try {
    const beforeData =
      input.beforeData === undefined ? null : redactForAudit(input.beforeData);
    const afterData =
      input.afterData === undefined ? null : redactForAudit(input.afterData);
    const metadata = input.metadata ? redactForAudit(input.metadata) : null;

    const ipAddress = input.request
      ? truncateIpForAudit(clientIpFromRequest(input.request))
      : null;
    const userAgentRaw = input.request?.headers.get("user-agent") ?? null;
    const userAgent = userAgentRaw
      ? userAgentRaw.slice(0, USER_AGENT_MAX_LENGTH)
      : null;

    // Round-11 commit 2.4a: actor email may arrive as plaintext OR
    // deterministic ciphertext. Resolve to plaintext-then-hash inside
    // the audit machinery so call sites don't need to encrypt /
    // decrypt themselves. Ciphertext wins if both are passed.
    const actorPlaintextEmail = input.actor.emailCiphertext
      ? decryptUserEmail(input.actor.emailCiphertext)
      : input.actor.email ?? null;

    await prisma.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorRole: (input.actor.role as UserRole | null | undefined) ?? null,
        actorEmailHash: actorPlaintextEmail
          ? shortEmailHash(actorPlaintextEmail)
          : null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        beforeData: beforeData as never,
        afterData: afterData as never,
        metadata: metadata as never,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    // Never throw — audit failure must not break the action being audited.
    // Use console.error directly (not logSafeError) to avoid a circular
    // dependency between audit and error-logging helpers.
    console.error("[audit-log] writeAudit failed:", err);
  }
}
