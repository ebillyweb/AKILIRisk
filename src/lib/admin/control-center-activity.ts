import "server-only";

import type { UserRole } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/db";
import { formatAuditDiffSummary } from "@/lib/audit/format-summary";
import { lookupActorDisplay } from "@/lib/audit/queries";
import type { ActivityType } from "@/components/admin/dashboard/RecentActivityItem";

const TAKE = 10;

/** High-volume or read-only actions omitted from the control-center feed. */
const EXCLUDED_ACTION_PREFIXES = [
  "data_access.",
  "auth.signin_failure",
  "auth.mfa_challenge_failure",
  "auth.magic_link_failure",
  "auth.magic_link_request",
] as const;

export type ControlCenterActivityIconKey =
  | "checkCircle"
  | "userPlus"
  | "clipboardList"
  | "alertTriangle"
  | "fileText"
  | "activity";

export interface ControlCenterActivity {
  id: string;
  type: ActivityType;
  iconKey: ControlCenterActivityIconKey;
  title: string;
  description: string;
  timestamp: string;
  user?: string;
}

function isExcludedAction(action: string): boolean {
  return EXCLUDED_ACTION_PREFIXES.some((prefix) => action.startsWith(prefix));
}

function humanizeAction(action: string): string {
  switch (action) {
    case "user.create":
      return "User created";
    case "user.update":
      return "User updated";
    case "user.soft_delete":
      return "User soft-deleted";
    case "user.restore":
      return "User restored";
    case "user.portal_access_toggle":
      return "Portal access changed";
    case "intake.submit":
      return "Intake submitted";
    case "intake.approve":
      return "Intake approved";
    case "intake.reject":
      return "Intake rejected";
    case "intake.review_started":
      return "Intake review started";
    case "intake.waiver_set":
      return "Intake waiver set";
    case "report.publish":
      return "Report published";
    case "assessment.rescore":
      return "Assessment re-scored";
    case "recommendation.create":
      return "Recommendation added";
    case "recommendation.update":
      return "Recommendation updated";
    case "recommendation.delete":
      return "Recommendation removed";
    case "recommendation.visibility_toggle":
      return "Recommendation visibility changed";
    case "invite.send":
      return "Invitation sent";
    case "invite.resend":
      return "Invitation resent";
    case "invite.expire":
      return "Invitation expired";
    case "governance_lead.assign":
      return "Assessment request assigned";
    case "auth.signin_success":
      return "Sign-in successful";
    case "auth.register":
      return "User registered";
    case "platform_settings.update":
      return "Platform settings updated";
    case "risk_thresholds.update":
      return "Risk thresholds updated";
    case "household_member.create":
      return "Household member added";
    case "household_member.update":
      return "Household member updated";
    case "household_member.delete":
      return "Household member removed";
    default: {
      const parts = action.split(".");
      if (parts.length >= 2) {
        const [entity, verb] = parts;
        return `${entity.replace(/_/g, " ")} ${verb.replace(/_/g, " ")}`;
      }
      return action;
    }
  }
}

function actionToActivityType(action: string): ActivityType {
  if (action.startsWith("intake.")) return "intake";
  if (action.startsWith("assessment.")) return "assessment";
  if (action.startsWith("report.")) return "report";
  if (
    action.startsWith("user.") ||
    action.startsWith("invite.") ||
    action.startsWith("governance_lead.")
  ) {
    return "advisor";
  }
  if (action.startsWith("subscription.") || action.startsWith("branding.")) {
    return "integration";
  }
  if (action.startsWith("recommendation")) return "assessment";
  return "system";
}

function actionToIconKey(action: string): ControlCenterActivityIconKey {
  switch (actionToActivityType(action)) {
    case "assessment":
      return "checkCircle";
    case "advisor":
      return "userPlus";
    case "intake":
      return "clipboardList";
    case "integration":
      return "alertTriangle";
    case "report":
      return "fileText";
    default:
      return "activity";
  }
}

function humanizeRole(role: UserRole): string {
  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      return "Admin";
    case "ADVISOR":
      return "Advisor";
    case "USER":
      return "Client";
    default:
      return role;
  }
}

function formatActorLabel(
  actorUserId: string | null,
  actorRole: UserRole | null,
  actorMap: Map<string, { email: string; name: string | null }>
): string | undefined {
  if (actorUserId) {
    const actor = actorMap.get(actorUserId);
    if (actor) return actor.name ?? actor.email;
  }
  if (actorRole) return humanizeRole(actorRole);
  if (!actorUserId) return "system";
  return undefined;
}

function buildDescription(
  entityType: string,
  entityId: string | null,
  beforeData: unknown,
  afterData: unknown
): string {
  const diff = formatAuditDiffSummary(beforeData, afterData);
  const target = entityId
    ? `${entityType} (${entityId.slice(0, 8)}…)`
    : entityType;
  return diff === "—" ? target : `${target} — ${diff}`;
}

/**
 * Recent platform events for `/admin` from the audit log.
 *
 * Admin-gated at the page layer. Excludes test traffic and noisy
 * data-access / failed-auth rows. Actor display uses the same batch
 * lookup as `/admin/audit-log`.
 */
export async function getControlCenterActivity(): Promise<
  ControlCenterActivity[] | null
> {
  try {
    const rows = await prisma.auditLog.findMany({
      where: {
        NOT: {
          OR: [
            ...EXCLUDED_ACTION_PREFIXES.map((prefix) => ({
              action: { startsWith: prefix },
            })),
            { metadata: { path: ["testOrigin"], equals: true } },
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorUserId: true,
        actorRole: true,
        beforeData: true,
        afterData: true,
        createdAt: true,
      },
    });

    const visible = rows.filter((row) => !isExcludedAction(row.action));
    const actorMap = await lookupActorDisplay(
      visible.map((row) => row.actorUserId)
    );

    return visible.map((row) => ({
      id: row.id,
      type: actionToActivityType(row.action),
      iconKey: actionToIconKey(row.action),
      title: humanizeAction(row.action),
      description: buildDescription(
        row.entityType,
        row.entityId,
        row.beforeData,
        row.afterData
      ),
      timestamp: formatDistanceToNow(row.createdAt, { addSuffix: true }),
      user: formatActorLabel(row.actorUserId, row.actorRole, actorMap),
    }));
  } catch {
    return null;
  }
}
