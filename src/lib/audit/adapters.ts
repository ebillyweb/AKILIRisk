import "server-only";

import type {
  AuditLog,
  AdvisorBrandingAuditLog,
  SubscriptionAuditLog,
  UserRole,
} from "@prisma/client";
import { BRANDING_ACTIONS } from "@/lib/audit/branding-audit";

/**
 * Round-8 unified read view across the three audit tables.
 *
 * Schema decision (P0 design + round-8 sign-off): the two legacy tables
 * (`SubscriptionAuditLog` typed enum columns; `AdvisorBrandingAuditLog` FK-
 * cascaded to AdvisorProfile) keep writing as-is. Only READS are unified —
 * `src/lib/audit/queries.ts` calls these adapters to project legacy rows
 * into the same shape the new generic `AuditLog` table already has.
 *
 * Why prefix ids: the unified view's `id` column must be globally unique
 * across sources so React keys, CSV exports, and the diff-modal selectors
 * all stay correct when rows from different tables coexist on a page.
 */

export type UnifiedAuditSource = "generic" | "subscription" | "branding";

/**
 * The canonical read shape. Mirrors the AuditLog model fields plus a
 * `source` discriminator so the page can show a small badge and so future
 * code can route back to the underlying table when needed.
 */
export interface UnifiedAuditRow {
  /** Source-prefixed: `gen:<cuid>` / `sub:<cuid>` / `brand:<cuid>`. */
  id: string;
  source: UnifiedAuditSource;
  createdAt: Date;
  actorUserId: string | null;
  actorRole: UserRole | null;
  actorEmailHash: string | null;
  /** Namespaced — `<entity>.<verb>` for AuditLog rows; `subscription.*` and
   *  `branding.*` for the legacy adapters. */
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
  ipAddress: string | null;
  userAgent: string | null;
}

// ── Source prefixes ──────────────────────────────────────────────────────

const PREFIX = {
  generic: "gen:",
  subscription: "sub:",
  branding: "brand:",
} as const;

export function genericIdPrefix(rawId: string): string {
  return `${PREFIX.generic}${rawId}`;
}

/**
 * Reverse of the prefix helpers. Returns the source the id came from plus
 * the original (un-prefixed) id. Returns null if the id has no recognized
 * prefix — defensive for old links that were generated before the prefix
 * was introduced.
 */
export function parseUnifiedAuditId(
  unifiedId: string
): { source: UnifiedAuditSource; originalId: string } | null {
  for (const [source, prefix] of Object.entries(PREFIX) as [
    UnifiedAuditSource,
    string,
  ][]) {
    if (unifiedId.startsWith(prefix)) {
      return { source, originalId: unifiedId.slice(prefix.length) };
    }
  }
  return null;
}

// ── Action namespace mapping ────────────────────────────────────────────

/**
 * Subscription action strings as used in writes today (see
 * `appendSubscriptionAuditLog` callers + `admin/actions.ts:269`):
 *   - "created", "stripe_sync", "payment_failed", "admin_new_advisor_grace"
 *
 * Adapter projects these into the `subscription.*` namespace by lowercasing
 * the original verb. New action strings inherit the same shape automatically;
 * the adapter doesn't need updating when callers add new action strings.
 */
export function namespaceSubscriptionAction(rawAction: string): string {
  return `subscription.${rawAction.toLowerCase()}`;
}

/**
 * Inverse of `namespaceSubscriptionAction`. Strip the `subscription.` prefix
 * to recover the raw action for filtering against the legacy table.
 */
export function denamespaceSubscriptionAction(unified: string): string | null {
  if (!unified.startsWith("subscription.")) return null;
  return unified.slice("subscription.".length);
}

/**
 * Branding actions are SCREAMING_SNAKE in the legacy const (UPDATE_BRANDING,
 * UPLOAD_LOGO, …). Adapter normalizes to lowercase under the `branding.*`
 * namespace.
 */
export function namespaceBrandingAction(rawAction: string): string {
  return `branding.${rawAction.toLowerCase()}`;
}

export function denamespaceBrandingAction(unified: string): string | null {
  if (!unified.startsWith("branding.")) return null;
  // Reverse the lowercasing: the legacy column stores SCREAMING_SNAKE.
  return unified.slice("branding.".length).toUpperCase();
}

/** Full set of legacy actions, namespaced. Surfaced to the page's filter
 *  multi-select so admins can pick legacy actions alongside generic ones. */
export const LEGACY_BRANDING_ACTION_NAMES = Object.values(BRANDING_ACTIONS).map(
  namespaceBrandingAction
);

/** Same for subscription actions. Hand-listed because there's no const —
 *  callers pass the raw string at write time. Add new action strings here
 *  when adding new SubscriptionAuditLog write sites so the unified-view
 *  filter dropdown picks them up. */
export const LEGACY_SUBSCRIPTION_ACTION_NAMES = [
  "created",
  "stripe_sync",
  "payment_failed",
  "admin_new_advisor_grace",
  // Round-9 (BRD §10.1 alignment): one-shot migration bumped existing
  // Subscription.clientLimit values from 10/25/75 to 25/50/100.
  "tier_limit_bump",
].map(namespaceSubscriptionAction);

// ── Adapter functions ───────────────────────────────────────────────────

/**
 * Project a SubscriptionAuditLog row into the unified shape.
 *
 * SubscriptionAuditLog has typed `previousTier` / `newTier` enum columns
 * (not free JSON). We pack them into beforeData/afterData under a `tier` key
 * so the diff-summary helper renders them consistently with generic rows.
 *
 * No actor: subscription rows are written by Stripe webhook handlers and
 * the admin createAdvisor transaction — no session user is captured today.
 * actorUserId/Role/EmailHash all null. The `source: "stripe_webhook"` tag
 * lives in metadata for traceability when admins click into the diff modal.
 */
export function subscriptionAuditRowToGeneric(
  row: SubscriptionAuditLog
): UnifiedAuditRow {
  // beforeData/afterData populated only when the typed columns are non-null.
  // Null on either side means "no tier change recorded" — leave the diff side
  // null so format-summary's "create/delete/update" logic works the same.
  const before =
    row.previousTier !== null
      ? { tier: row.previousTier }
      : null;
  const after =
    row.newTier !== null
      ? { tier: row.newTier }
      : null;

  return {
    id: `${PREFIX.subscription}${row.id}`,
    source: "subscription",
    createdAt: row.timestamp,
    actorUserId: null,
    actorRole: null,
    actorEmailHash: null,
    action: namespaceSubscriptionAction(row.action),
    entityType: "Subscription",
    entityId: row.subscriptionId,
    beforeData: before,
    afterData: after,
    // Preserve the original action name in metadata so a CSV reader can
    // round-trip back to the legacy action without re-deriving it from the
    // namespaced form.
    metadata: {
      source: "stripe_webhook_or_admin",
      legacyAction: row.action,
      ...(row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {}),
    },
    ipAddress: null,
    userAgent: null,
  };
}

/**
 * Project an AdvisorBrandingAuditLog row into the unified shape.
 *
 * Branding rows DO carry an actor (`userId` column — user-driven, not
 * webhook-driven), so actorUserId is populated. actorRole/EmailHash are
 * not stored on the legacy row; the page's `lookupActorDisplay` helper
 * resolves the display name at render time, same as for generic rows.
 *
 * Branding rows store before/after under `previousValues` / `newValues`
 * (legacy column names). Adapter renames to the unified `beforeData` /
 * `afterData` so the diff modal works without source-aware branching.
 */
export function brandingAuditRowToGeneric(
  row: AdvisorBrandingAuditLog
): UnifiedAuditRow {
  return {
    id: `${PREFIX.branding}${row.id}`,
    source: "branding",
    createdAt: row.timestamp,
    actorUserId: row.userId,
    actorRole: null,
    actorEmailHash: null,
    action: namespaceBrandingAction(row.action),
    // Use a distinct entityType from "AdvisorProfile" so the unified entity
    // filter ("Subscription" / "AdvisorBranding" / generic types) stays
    // unambiguous. The underlying entityId still points at the AdvisorProfile.
    entityType: "AdvisorBranding",
    entityId: row.entityId ?? row.advisorId,
    beforeData: row.previousValues,
    afterData: row.newValues,
    metadata: {
      legacyAction: row.action,
      legacyEntityType: row.entityType,
      advisorProfileId: row.advisorId,
      ...(row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {}),
    },
    ipAddress: null,
    userAgent: null,
  };
}

/**
 * Project a generic AuditLog row into the unified shape — trivial because
 * it's already the right shape; we only add the `source` field and prefix
 * the id. Kept as a function (not inlined) so the queries layer treats all
 * three sources symmetrically.
 */
export function genericAuditRowToUnified(row: AuditLog): UnifiedAuditRow {
  return {
    id: `${PREFIX.generic}${row.id}`,
    source: "generic",
    createdAt: row.createdAt,
    actorUserId: row.actorUserId,
    actorRole: row.actorRole,
    actorEmailHash: row.actorEmailHash,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeData: row.beforeData,
    afterData: row.afterData,
    metadata: row.metadata,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
  };
}
