import "server-only";

import { prisma } from "@/lib/db";
import { decryptUserEmail } from "@/lib/auth/user-email";
import { CATEGORY_LABELS } from "@/lib/analytics/formatters";
import { normalizePillarScoreId } from "@/lib/assessment/pillar-registry";
import { getSeverity } from "@/lib/intelligence/queries";
import type { RiskSeverity } from "@/lib/intelligence/types";
import type { PillarScoreSnapshot } from "@/lib/signals/types";
import { SCORE_DECLINE_THRESHOLD } from "@/lib/signals/types";
import type { SignalType } from "@prisma/client";

type EmitContext = {
  clientId: string;
  clientName: string;
  assessmentId: string;
  version: number;
};

type PendingSignal = {
  type: SignalType;
  severity: RiskSeverity;
  title: string;
  message: string;
  dedupeKey: string;
  payload: {
    assessmentId: string;
    pillarId?: string;
    pillarName?: string;
    scoreBefore?: number;
    scoreAfter?: number;
    triggerCode?: string;
    assessmentVersion?: number;
    reportId?: string;
    href: string;
  };
};

function pillarLabel(pillarId: string): string {
  return CATEGORY_LABELS[pillarId] ?? CATEGORY_LABELS[normalizePillarScoreId(pillarId)] ?? pillarId;
}

function intelligenceHref(clientId: string): string {
  return `/advisor/intelligence/${clientId}`;
}

function pipelineHref(clientId: string): string {
  return `/advisor/pipeline/${clientId}`;
}

function reportHref(clientId: string): string {
  return `/advisor/pipeline/${clientId}/report`;
}

function severityFromScore(score: number): RiskSeverity {
  return getSeverity(score);
}

function upsellTriggerSeverity(code: string): RiskSeverity {
  if (code.startsWith("domain_flag:") || code.startsWith("kri:")) {
    return "critical";
  }
  return "moderate";
}

function wasCritical(score: number): boolean {
  return getSeverity(score) === "critical";
}

function wasModerate(score: number): boolean {
  return getSeverity(score) === "moderate";
}

function snapshotByPillar(
  rows: PillarScoreSnapshot[] | null | undefined
): Map<string, PillarScoreSnapshot> {
  const map = new Map<string, PillarScoreSnapshot>();
  for (const row of rows ?? []) {
    map.set(normalizePillarScoreId(row.pillar), row);
  }
  return map;
}

function buildPillarTransitionSignals(
  ctx: EmitContext,
  before: Map<string, PillarScoreSnapshot>,
  after: PillarScoreSnapshot[]
): PendingSignal[] {
  const pending: PendingSignal[] = [];

  for (const row of after) {
    const pillarId = normalizePillarScoreId(row.pillar);
    const prev = before.get(pillarId);
    const pillarName = pillarLabel(pillarId);
    const afterSeverity = severityFromScore(row.score);

    if (!prev) {
      if (afterSeverity === "critical") {
        pending.push({
          type: "PILLAR_CRITICAL",
          severity: "critical",
          title: `Critical risk — ${pillarName}`,
          message: `${ctx.clientName} scored ${row.score.toFixed(1)}/10 on ${pillarName}.`,
          dedupeKey: `${ctx.assessmentId}:critical:${pillarId}`,
          payload: {
            assessmentId: ctx.assessmentId,
            pillarId,
            pillarName,
            scoreAfter: row.score,
            assessmentVersion: ctx.version,
            href: intelligenceHref(ctx.clientId),
          },
        });
      } else if (afterSeverity === "moderate") {
        pending.push({
          type: "PILLAR_MODERATE",
          severity: "moderate",
          title: `Elevated risk — ${pillarName}`,
          message: `${ctx.clientName} scored ${row.score.toFixed(1)}/10 on ${pillarName}.`,
          dedupeKey: `${ctx.assessmentId}:moderate:${pillarId}`,
          payload: {
            assessmentId: ctx.assessmentId,
            pillarId,
            pillarName,
            scoreAfter: row.score,
            assessmentVersion: ctx.version,
            href: intelligenceHref(ctx.clientId),
          },
        });
      }
      continue;
    }

    const decline = prev.score - row.score;
    if (decline >= SCORE_DECLINE_THRESHOLD) {
      pending.push({
        type: "SCORE_DECLINED",
        severity: severityFromScore(row.score),
        title: `Score declined — ${pillarName}`,
        message: `${ctx.clientName}: ${prev.score.toFixed(1)} → ${row.score.toFixed(1)} on ${pillarName}.`,
        dedupeKey: `${ctx.assessmentId}:decline:${pillarId}:v${ctx.version}`,
        payload: {
          assessmentId: ctx.assessmentId,
          pillarId,
          pillarName,
          scoreBefore: prev.score,
          scoreAfter: row.score,
          assessmentVersion: ctx.version,
          href: intelligenceHref(ctx.clientId),
        },
      });
    }

    if (!wasCritical(prev.score) && afterSeverity === "critical") {
      pending.push({
        type: "PILLAR_CRITICAL",
        severity: "critical",
        title: `Critical risk — ${pillarName}`,
        message: `${ctx.clientName} moved to critical on ${pillarName} (${row.score.toFixed(1)}/10).`,
        dedupeKey: `${ctx.assessmentId}:critical:${pillarId}`,
        payload: {
          assessmentId: ctx.assessmentId,
          pillarId,
          pillarName,
          scoreBefore: prev.score,
          scoreAfter: row.score,
          assessmentVersion: ctx.version,
          href: intelligenceHref(ctx.clientId),
        },
      });
    } else if (!wasModerate(prev.score) && !wasCritical(prev.score) && afterSeverity === "moderate") {
      pending.push({
        type: "PILLAR_MODERATE",
        severity: "moderate",
        title: `Elevated risk — ${pillarName}`,
        message: `${ctx.clientName} moved to moderate on ${pillarName} (${row.score.toFixed(1)}/10).`,
        dedupeKey: `${ctx.assessmentId}:moderate:${pillarId}`,
        payload: {
          assessmentId: ctx.assessmentId,
          pillarId,
          pillarName,
          scoreBefore: prev.score,
          scoreAfter: row.score,
          assessmentVersion: ctx.version,
          href: intelligenceHref(ctx.clientId),
        },
      });
    }
  }

  return pending;
}

function buildUpsellSignals(
  ctx: EmitContext,
  before: string[] | null,
  after: string[]
): PendingSignal[] {
  const prev = new Set(before ?? []);
  const pending: PendingSignal[] = [];

  for (const code of after) {
    if (prev.has(code)) continue;
    const severity = upsellTriggerSeverity(code);
    pending.push({
      type: "UPSELL_TRIGGER",
      severity,
      title: "Remediation warranted",
      message: `${ctx.clientName}: ${code.replace(/_/g, " ")}.`,
      dedupeKey: `${ctx.assessmentId}:upsell:${code}:v${ctx.version}`,
      payload: {
        assessmentId: ctx.assessmentId,
        triggerCode: code,
        assessmentVersion: ctx.version,
        href: pipelineHref(ctx.clientId),
      },
    });
  }

  return pending;
}

async function persistSignals(advisorId: string, clientId: string, pending: PendingSignal[]) {
  if (pending.length === 0) return;

  for (const signal of pending) {
    try {
      await prisma.advisorSignal.create({
        data: {
          advisorId,
          clientId,
          type: signal.type,
          severity: signal.severity,
          title: signal.title,
          message: signal.message,
          dedupeKey: signal.dedupeKey,
          payload: signal.payload,
        },
      });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code
          : undefined;
      if (code === "P2002") continue;
      console.error("[signals] emit failed", { advisorId, dedupeKey: signal.dedupeKey, err });
    }
  }
}

export async function getActiveAdvisorIdsForClient(clientId: string): Promise<string[]> {
  const rows = await prisma.clientAdvisorAssignment.findMany({
    where: { clientId, status: "ACTIVE" },
    select: { advisorId: true },
  });
  return rows.map((r) => r.advisorId);
}

export async function resolveClientDisplayName(clientId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: clientId },
    select: { emailCiphertext: true, name: true, firstName: true, lastName: true },
  });
  if (!user) return "Client";
  if (user.name?.trim()) return user.name.trim();
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return decryptUserEmail(user.emailCiphertext);
}

export async function emitAssessmentSignals(params: {
  clientId: string;
  assessmentId: string;
  version: number;
  event: "completed" | "rescored" | "pillar_scored";
  beforeScores: PillarScoreSnapshot[] | null;
  afterScores: PillarScoreSnapshot[];
  upsellTriggersBefore?: string[] | null;
  upsellTriggersAfter?: string[] | null;
}): Promise<void> {
  const advisorIds = await getActiveAdvisorIdsForClient(params.clientId);
  if (advisorIds.length === 0) return;

  const clientName = await resolveClientDisplayName(params.clientId);
  const ctx: EmitContext = {
    clientId: params.clientId,
    clientName,
    assessmentId: params.assessmentId,
    version: params.version,
  };

  const beforeMap = snapshotByPillar(params.beforeScores);
  const pillarSignals = buildPillarTransitionSignals(ctx, beforeMap, params.afterScores);
  const upsellSignals = buildUpsellSignals(
    ctx,
    params.upsellTriggersBefore ?? null,
    params.upsellTriggersAfter ?? []
  );

  const lifecycle: PendingSignal[] = [];
  if (params.event === "completed") {
    lifecycle.push({
      type: "ASSESSMENT_COMPLETED",
      severity: "low",
      title: "Assessment completed",
      message: `${clientName} finished all assessment pillars.`,
      dedupeKey: `${params.assessmentId}:completed`,
      payload: {
        assessmentId: params.assessmentId,
        assessmentVersion: params.version,
        href: intelligenceHref(params.clientId),
      },
    });
  } else if (params.event === "rescored") {
    lifecycle.push({
      type: "ASSESSMENT_RESCORED",
      severity: "low",
      title: "Assessment re-scored",
      message: `${clientName} assessment updated to version ${params.version}.`,
      dedupeKey: `${params.assessmentId}:rescored:v${params.version}`,
      payload: {
        assessmentId: params.assessmentId,
        assessmentVersion: params.version,
        href: intelligenceHref(params.clientId),
      },
    });
  }

  const all = [...pillarSignals, ...upsellSignals, ...lifecycle];

  await Promise.all(
    advisorIds.map((advisorId) => persistSignals(advisorId, params.clientId, all))
  );
}

export async function emitAssessmentAnswersChangedSignal(params: {
  clientId: string;
  assessmentId: string;
  version: number;
  changedAt: Date;
}): Promise<void> {
  const advisorIds = await getActiveAdvisorIdsForClient(params.clientId);
  if (advisorIds.length === 0) return;

  const clientName = await resolveClientDisplayName(params.clientId);
  const dedupeKey = `${params.assessmentId}:answers_changed`;
  const message = `${clientName} updated assessment answers after completion. Re-score when ready (currently v${params.version}).`;

  await Promise.all(
    advisorIds.map((advisorId) =>
      prisma.advisorSignal.upsert({
        where: {
          advisorId_dedupeKey: { advisorId, dedupeKey },
        },
        create: {
          advisorId,
          clientId: params.clientId,
          type: "ASSESSMENT_ANSWERS_CHANGED",
          severity: "moderate",
          title: "Assessment answers changed",
          message,
          dedupeKey,
          payload: {
            assessmentId: params.assessmentId,
            assessmentVersion: params.version,
            href: pipelineHref(params.clientId),
          },
        },
        update: {
          message,
          severity: "moderate",
          readAt: null,
          createdAt: params.changedAt,
          payload: {
            assessmentId: params.assessmentId,
            assessmentVersion: params.version,
            href: pipelineHref(params.clientId),
          },
        },
      }),
    ),
  );
}

export async function emitReportPublishedSignal(params: {
  clientId: string;
  assessmentId: string;
  reportId: string;
  version: number;
}): Promise<void> {
  const advisorIds = await getActiveAdvisorIdsForClient(params.clientId);
  if (advisorIds.length === 0) return;

  const clientName = await resolveClientDisplayName(params.clientId);
  const pending: PendingSignal = {
    type: "REPORT_PUBLISHED",
    severity: "low",
    title: "Report published",
    message: `${clientName}: risk profile report v${params.version} is published.`,
    dedupeKey: `${params.reportId}:published`,
    payload: {
      assessmentId: params.assessmentId,
      reportId: params.reportId,
      assessmentVersion: params.version,
      href: reportHref(params.clientId),
    },
  };

  await Promise.all(
    advisorIds.map((advisorId) => persistSignals(advisorId, params.clientId, [pending]))
  );
}
