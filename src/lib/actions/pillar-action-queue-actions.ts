"use server";

import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isAdvisorHubNavRole } from "@/lib/auth-roles";
import { prisma } from "@/lib/db";
import { getOrCreateDraft } from "@/lib/actions/report-actions";
import {
  isDuplicateQueuedAction,
  parseQueuedPillarActions,
  type QueuedPillarAction,
} from "@/lib/reports/pillar-action-queue";

export type PillarActionQueueResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

const ACTION_TEXT_MAX = 2000;

export async function queuePillarActionForClient(input: {
  clientUserId: string;
  questionId: string;
  questionLabel: string;
  actionText: string;
  pillar?: string | null;
  source: "intake" | "assessment";
}): Promise<PillarActionQueueResult<{ queued: QueuedPillarAction }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "not_authenticated", message: "Sign in required." };
  }
  if (!isAdvisorHubNavRole(session.user.role)) {
    return { ok: false, code: "forbidden", message: "Staff access only." };
  }

  const actionText = input.actionText.trim();
  if (!actionText) {
    return { ok: false, code: "empty_action", message: "No recommended action to queue." };
  }
  if (actionText.length > ACTION_TEXT_MAX) {
    return {
      ok: false,
      code: "action_too_long",
      message: `Action text exceeds ${ACTION_TEXT_MAX} characters.`,
    };
  }

  const latestAssessment = await prisma.assessment.findFirst({
    where: { userId: input.clientUserId },
    orderBy: { startedAt: "desc" },
    select: { id: true },
  });
  if (!latestAssessment) {
    return {
      ok: false,
      code: "no_assessment",
      message: "Client has no assessment yet — start an assessment before queuing actions.",
    };
  }

  const draftResult = await getOrCreateDraft(latestAssessment.id);
  if (!draftResult.ok) {
    return { ok: false, code: draftResult.code, message: draftResult.message };
  }

  const draft = await prisma.report.findUnique({
    where: { id: draftResult.data.reportId },
    select: { id: true, status: true, queuedPillarActions: true },
  });
  if (!draft || draft.status !== "DRAFT") {
    return { ok: false, code: "not_draft", message: "Report draft not available." };
  }

  const existing = parseQueuedPillarActions(draft.queuedPillarActions);
  if (isDuplicateQueuedAction(existing, input.questionId, actionText)) {
    return {
      ok: false,
      code: "duplicate",
      message: "This action is already in the report queue.",
    };
  }

  const queued: QueuedPillarAction = {
    id: crypto.randomUUID(),
    questionId: input.questionId,
    questionLabel: input.questionLabel.trim() || input.questionId,
    pillar: input.pillar?.trim() || null,
    source: input.source,
    actionText,
    queuedAt: new Date().toISOString(),
    queuedByUserId: session.user.id,
  };

  await prisma.report.update({
    where: { id: draft.id },
    data: {
      queuedPillarActions: [...existing, queued] as unknown as Prisma.InputJsonValue,
    },
  });

  return { ok: true, data: { queued } };
}

export async function removeQueuedPillarAction(input: {
  reportId: string;
  actionId: string;
}): Promise<PillarActionQueueResult<{ removed: boolean }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, code: "not_authenticated", message: "Sign in required." };
  }
  if (!isAdvisorHubNavRole(session.user.role)) {
    return { ok: false, code: "forbidden", message: "Staff access only." };
  }

  const draft = await prisma.report.findUnique({
    where: { id: input.reportId },
    select: { id: true, status: true, queuedPillarActions: true },
  });
  if (!draft || draft.status !== "DRAFT") {
    return { ok: false, code: "not_draft", message: "Only draft reports can be edited." };
  }

  const existing = parseQueuedPillarActions(draft.queuedPillarActions);
  const next = existing.filter((a) => a.id !== input.actionId);
  if (next.length === existing.length) {
    return { ok: false, code: "not_found", message: "Queued action not found." };
  }

  await prisma.report.update({
    where: { id: draft.id },
    data: {
      queuedPillarActions: next as unknown as Prisma.InputJsonValue,
    },
  });

  return { ok: true, data: { removed: true } };
}
