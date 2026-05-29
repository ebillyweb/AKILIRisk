import "server-only";

import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import type { RiskSeverity } from "@/lib/intelligence/types";
import {
  DEFAULT_SIGNAL_SEVERITY_FILTER,
  SIGNAL_FEED_WINDOW_DAYS,
  type SignalFeedFilters,
  type SignalFeedItem,
  type SignalFeedSummary,
  type WorkflowSignalFeedItem,
  type RiskSignalFeedItem,
} from "@/lib/signals/types";

const WORKFLOW_NOTIFICATION_TYPES: NotificationType[] = [
  "NEW_INTAKE",
  "INTAKE_UPDATED",
  "WORKFLOW_STALLED",
  "MILESTONE_COMPLETE",
  "DOCUMENT_UPLOADED",
  "CLIENT_REGISTERED",
];

function workflowSeverity(type: NotificationType): RiskSeverity {
  switch (type) {
    case "WORKFLOW_STALLED":
    case "NEW_INTAKE":
      return "moderate";
    case "MILESTONE_COMPLETE":
    case "DOCUMENT_UPLOADED":
    case "CLIENT_REGISTERED":
      return "low";
    default:
      return "low";
  }
}

function workflowHref(type: NotificationType, referenceId: string | null): string {
  if (type === "NEW_INTAKE" || type === "INTAKE_UPDATED") {
    return referenceId ? `/advisor/review/${referenceId}` : "/advisor/pipeline?awaitingReview=1";
  }
  if (type === "WORKFLOW_STALLED") {
    return "/advisor/pipeline?stalled=1";
  }
  if (type === "DOCUMENT_UPLOADED") {
    return "/advisor/pipeline";
  }
  return "/advisor/notifications";
}

function mapNotificationToWorkflowItem(
  n: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    referenceId: string | null;
    read: boolean;
    createdAt: Date;
  }
): WorkflowSignalFeedItem {
  return {
    kind: "workflow",
    id: n.id,
    notificationType: n.type,
    severity: workflowSeverity(n.type),
    title: n.title,
    message: n.message,
    href: workflowHref(n.type, n.referenceId),
    read: n.read,
    createdAt: n.createdAt,
  };
}

export async function getAdvisorSignalFeed(
  advisorProfileId: string,
  filters: SignalFeedFilters = {}
): Promise<{ items: SignalFeedItem[]; summary: SignalFeedSummary }> {
  const since = new Date();
  since.setDate(since.getDate() - SIGNAL_FEED_WINDOW_DAYS);

  const severityFilter = filters.severity ?? DEFAULT_SIGNAL_SEVERITY_FILTER;
  const kinds = filters.kinds ?? ["risk", "workflow"];
  const limit = filters.limit ?? 50;

  const assignedClientIds = await prisma.clientAdvisorAssignment.findMany({
    where: { advisorId: advisorProfileId, status: "ACTIVE" },
    select: { clientId: true },
  });
  const clientIdSet = new Set(assignedClientIds.map((a) => a.clientId));

  const [riskRows, notifications] = await Promise.all([
    kinds.includes("risk")
      ? prisma.advisorSignal.findMany({
          where: {
            advisorId: advisorProfileId,
            createdAt: { gte: since },
            ...(filters.unreadOnly ? { readAt: null } : {}),
            severity: { in: severityFilter },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            client: {
              select: {
                id: true,
                emailCiphertext: true,
                name: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    kinds.includes("workflow")
      ? prisma.advisorNotification.findMany({
          where: {
            advisorId: advisorProfileId,
            createdAt: { gte: since },
            type: { in: WORKFLOW_NOTIFICATION_TYPES },
            ...(filters.unreadOnly ? { read: false } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : Promise.resolve([]),
  ]);

  const riskItems: RiskSignalFeedItem[] = riskRows
    .filter((row) => clientIdSet.has(row.clientId))
    .map((row) => {
      const client = row.client;
      let clientName = "Client";
      if (client.name?.trim()) {
        clientName = client.name.trim();
      } else {
        const parts = [client.firstName, client.lastName].filter(Boolean);
        clientName =
          parts.length > 0 ? parts.join(" ") : decryptUserEmail(client.emailCiphertext);
      }

      const payload = (row.payload ?? { href: `/advisor/intelligence/${row.clientId}` }) as RiskSignalFeedItem["payload"];

      return {
        kind: "risk" as const,
        id: row.id,
        advisorId: row.advisorId,
        clientId: row.clientId,
        clientName,
        source: "INTERNAL_ASSESSMENT" as const,
        type: row.type,
        severity: row.severity as RiskSeverity,
        title: row.title,
        message: row.message,
        payload,
        read: row.readAt != null,
        createdAt: row.createdAt,
      };
    });

  const workflowItems = notifications
    .filter((n) => {
      const sev = workflowSeverity(n.type);
      return severityFilter.includes(sev);
    })
    .map(mapNotificationToWorkflowItem);

  const items = [...riskItems, ...workflowItems]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);

  const unreadRisk = await prisma.advisorSignal.count({
    where: {
      advisorId: advisorProfileId,
      readAt: null,
      createdAt: { gte: since },
      severity: { in: severityFilter },
    },
  });
  const unreadWorkflow = await prisma.advisorNotification.count({
    where: {
      advisorId: advisorProfileId,
      read: false,
      createdAt: { gte: since },
      type: { in: WORKFLOW_NOTIFICATION_TYPES },
    },
  });

  const criticalCount = items.filter((i) => i.severity === "critical").length;
  const moderateCount = items.filter((i) => i.severity === "moderate").length;

  return {
    items,
    summary: {
      unreadCount: unreadRisk + unreadWorkflow,
      criticalCount,
      moderateCount,
      workflowCount: workflowItems.length,
      riskCount: riskItems.length,
    },
  };
}

export async function markAdvisorSignalRead(
  signalId: string,
  advisorProfileId: string
): Promise<boolean> {
  const result = await prisma.advisorSignal.updateMany({
    where: { id: signalId, advisorId: advisorProfileId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count > 0;
}

export async function markAllAdvisorSignalsRead(advisorProfileId: string): Promise<number> {
  const result = await prisma.advisorSignal.updateMany({
    where: { advisorId: advisorProfileId, readAt: null },
    data: { readAt: new Date() },
  });
  return result.count;
}
