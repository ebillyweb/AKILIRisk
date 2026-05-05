import "server-only";

import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { clientIpFromRequest } from "@/lib/request-ip";
import { redactForAudit, shortEmailHash } from "./redact";
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

  // ── System actions (P1) ───────────────────────────────────────────────────
  /** Written by /api/cron/audit-log-retention each successful sweep. */
  SYSTEM_RETENTION_SWEEP: "system.retention_sweep",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

const USER_AGENT_MAX_LENGTH = 256;

/**
 * Actor identification passed to writeAudit. `null`/`undefined` actor info
 * is supported for system actions.
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

    await prisma.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorRole: (input.actor.role as UserRole | null | undefined) ?? null,
        actorEmailHash: input.actor.email
          ? shortEmailHash(input.actor.email)
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
