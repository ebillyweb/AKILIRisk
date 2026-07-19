import "server-only";

import { createHash } from "crypto";
import { PillarCategoryKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/assessment/governance-rubric";
import { getActiveRiskThresholds } from "@/lib/assessment/risk-thresholds";
import {
  pillarQuestionInclude,
  pillarQuestionRowToWire,
  sortPillarQuestionRows,
  type PillarQuestionWithHierarchy,
} from "@/lib/assessment/bank/pillar-question-wire";
import { riskAreaIdForPillarCategory } from "@/lib/assessment/bank/pillar-category-risk-area";
import type {
  MethodologySnapshotBlob,
  ParsedMethodologySnapshot,
} from "@/lib/methodology/types";
import { filterAndOrderQuestionsByBankMode } from "@/lib/methodology/intake-question-bank-mode";
import {
  resolveEffectiveAdvisorAssessmentQuestionBankMode,
  resolveEffectiveAdvisorIntakeQuestionBankMode,
} from "@/lib/methodology/intake-question-bank-mode.server";
import { advisorAssessmentQuestionToWire } from "@/lib/methodology/advisor-assessment-question-config";
import {
  SNAPSHOT_MAX_BYTES,
  SNAPSHOT_SCHEMA_VERSION,
} from "@/lib/methodology/types";

export async function getAssignedAdvisorProfileIdForClient(
  clientUserId: string,
): Promise<string | null> {
  const assignment = await prisma.clientAdvisorAssignment.findFirst({
    where: { clientId: clientUserId, status: "ACTIVE" },
    orderBy: { assignedAt: "desc" },
    select: { advisorId: true },
  });
  return assignment?.advisorId ?? null;
}

export async function ensureAdvisorDefaultsCloned(
  advisorProfileId: string,
): Promise<void> {
  const { cloneAdvisorDefaultsIfNeeded, syncAdvisorPlatformContent } = await import(
    "@/lib/methodology/clone-advisor-defaults"
  );
  await cloneAdvisorDefaultsIfNeeded(advisorProfileId);
  await syncAdvisorPlatformContent(advisorProfileId);
}

export async function buildAdvisorConfigSnapshot(
  advisorProfileId: string,
  includedPillarSlugs?: string[],
): Promise<MethodologySnapshotBlob> {
  await ensureAdvisorDefaultsCloned(advisorProfileId);

  const defaultThresholds = await getActiveRiskThresholds();

  const pillars = await prisma.pillar.findMany({
    where: { archivedAt: null },
    orderBy: { defaultOrder: "asc" },
  });

  const overrides = await prisma.advisorPillarOverride.findMany({
    where: { advisorProfileId },
  });
  const overrideByPillarId = new Map(overrides.map((o) => [o.pillarId, o]));

  const snapshotPillars = pillars.map((pillar) => {
    const override = overrideByPillarId.get(pillar.id);
    const threshold =
      (override?.threshold as {
        lowMin: number;
        mediumMin: number;
        highMin: number;
      } | null) ?? defaultThresholds;
    return {
      pillarId: pillar.id,
      slug: pillar.slug,
      canonicalName: pillar.canonicalName,
      isActive: override?.isActive ?? true,
      displayName: override?.displayName ?? null,
      weight: override?.weight ?? 10,
      threshold: {
        lowMin: threshold.lowMin ?? DEFAULT_RISK_THRESHOLDS.lowMin,
        mediumMin: threshold.mediumMin ?? DEFAULT_RISK_THRESHOLDS.mediumMin,
        highMin: threshold.highMin ?? DEFAULT_RISK_THRESHOLDS.highMin,
      },
      emphasisMultiplier: override?.emphasisMultiplier ?? 1.5,
      displayOrder: override?.displayOrder ?? pillar.defaultOrder,
      version: override?.version ?? 1,
    };
  });

  const activeSlugs = snapshotPillars.filter((p) => p.isActive).map((p) => p.slug);
  const scopedSlugs =
    includedPillarSlugs && includedPillarSlugs.length > 0
      ? activeSlugs.filter((s) => includedPillarSlugs.includes(s))
      : activeSlugs;

  const assessmentQuestions: MethodologySnapshotBlob["assessmentQuestions"] = {};
  const advisorQuestions = await prisma.advisorPillarQuestion.findMany({
    where: { advisorProfileId, isVisible: true },
    include: { pillar: true },
    orderBy: [{ pillarId: "asc" }, { displayOrder: "asc" }],
  });

  const assessmentBankMode = await resolveEffectiveAdvisorAssessmentQuestionBankMode(
    advisorProfileId,
  );
  const activeAssessmentRows = filterAndOrderQuestionsByBankMode(
    advisorQuestions,
    assessmentBankMode,
  );

  for (const row of activeAssessmentRows) {
    if (!scopedSlugs.includes(row.pillar.slug)) continue;
    const wire = advisorAssessmentQuestionToWire({
      id: row.id,
      displayOrder: row.displayOrder,
      questionText: row.questionText,
      answerType: row.answerType,
      scoreMap: row.scoreMap,
      answer0: row.answer0,
      answer1: row.answer1,
      answer2: row.answer2,
      answer3: row.answer3,
      whyThisMatters: row.whyThisMatters,
      recommendedActions: row.recommendedActions,
      pillarSlug: row.pillar.slug,
    });
    if (!assessmentQuestions[row.pillar.slug]) {
      assessmentQuestions[row.pillar.slug] = [];
    }
    assessmentQuestions[row.pillar.slug]!.push(wire);
  }

  const intakeRows = await prisma.advisorIntakeQuestion.findMany({
    where: { advisorProfileId, isVisible: true },
    orderBy: { displayOrder: "asc" },
  });
  const intakeBankMode = await resolveEffectiveAdvisorIntakeQuestionBankMode(advisorProfileId);
  const activeIntakeRows = filterAndOrderQuestionsByBankMode(intakeRows, intakeBankMode);

  const intakeQuestions = activeIntakeRows.map((row) => ({
    id: row.id,
    displayOrder: row.displayOrder,
    questionNumber: row.questionNumber,
    questionText: row.questionText,
    context: row.context,
    helpText: row.helpText,
    learnMore: row.learnMore,
    answerType: row.answerType,
    answer0: row.answer0,
    answer1: row.answer1,
    answer2: row.answer2,
    answer3: row.answer3,
    options: row.options,
    relatedPillarIds: row.relatedPillarIds,
    recommendedActions: row.recommendedActions,
    isVisible: row.isVisible,
    version: row.version,
  }));

  const narrativeRows = await prisma.advisorPillarNarrative.findMany({
    where: { advisorProfileId },
    include: { pillar: true },
  });
  const pillarNarratives: MethodologySnapshotBlob["pillarNarratives"] = {};
  for (const row of narrativeRows) {
    if (!scopedSlugs.includes(row.pillar.slug)) continue;
    pillarNarratives[row.pillar.slug] = {
      pillarId: row.pillarId,
      slug: row.pillar.slug,
      allNegative: row.allNegative as string[],
      allYes: row.allYes as string[],
      midBand: row.midBand as unknown as MethodologySnapshotBlob["pillarNarratives"][string]["midBand"],
      version: row.version,
    };
  }

  const recRuleRows = await prisma.advisorRecommendationRule.findMany({
    where: { advisorProfileId, isActive: true },
    include: { pillar: true },
    orderBy: { priority: "desc" },
  });

  const recRules = recRuleRows.map((rule) => {
    const payload = rule.servicePayload as {
      serviceId?: string;
      serviceRecommendationId?: string;
    };
    const serviceId = payload.serviceId ?? payload.serviceRecommendationId ?? "";
    return {
      id: rule.id,
      pillarId: rule.pillarId,
      pillarSlug: rule.pillar?.slug ?? null,
      name: rule.name,
      serviceId,
      conditions: rule.triggerConditions as unknown as MethodologySnapshotBlob["recRules"][0]["conditions"],
      priority: rule.priority,
      isActive: rule.isActive,
      version: rule.version,
    };
  });

  const catalogVersion = pillars[0]?.catalogVersion ?? 1;

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    catalogVersion,
    includedPillarSlugs: scopedSlugs,
    pillars: snapshotPillars,
    assessmentQuestions,
    intakeQuestions,
    pillarNarratives,
    recRules,
  };
}

export function hashSnapshotBlob(blob: MethodologySnapshotBlob): string {
  return createHash("sha256").update(JSON.stringify(blob)).digest("hex");
}

export function assertSnapshotSize(blob: MethodologySnapshotBlob): void {
  const bytes = Buffer.byteLength(JSON.stringify(blob), "utf8");
  if (bytes > SNAPSHOT_MAX_BYTES) {
    throw new Error(`Snapshot blob exceeds ${SNAPSHOT_MAX_BYTES} bytes (${bytes})`);
  }
}

export async function writeIntakeSnapshot(
  interviewId: string,
  advisorProfileId: string,
  includedPillarSlugs?: string[],
): Promise<ParsedMethodologySnapshot> {
  const existing = await prisma.intakeSnapshot.findUnique({
    where: { intakeInterviewId: interviewId },
  });
  if (existing) {
    return parseSnapshotRow(existing);
  }

  const blob = await buildAdvisorConfigSnapshot(advisorProfileId, includedPillarSlugs);
  assertSnapshotSize(blob);
  const snapshotHash = hashSnapshotBlob(blob);

  const row = await prisma.intakeSnapshot.create({
    data: {
      intakeInterviewId: interviewId,
      advisorProfileId,
      snapshotBlob: blob as object,
      snapshotHash,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    },
  });

  return parseSnapshotRow(row);
}

function parseSnapshotRow(row: {
  id: string;
  advisorProfileId: string;
  snapshotBlob: unknown;
  takenAt: Date;
}): ParsedMethodologySnapshot {
  const blob = row.snapshotBlob as MethodologySnapshotBlob;
  return {
    ...blob,
    snapshotId: row.id,
    advisorProfileId: row.advisorProfileId,
    takenAt: row.takenAt,
  };
}

export async function loadSnapshotForInterview(
  interviewId: string,
): Promise<ParsedMethodologySnapshot | null> {
  const row = await prisma.intakeSnapshot.findUnique({
    where: { intakeInterviewId: interviewId },
  });
  return row ? parseSnapshotRow(row) : null;
}

/**
 * Load the methodology snapshot pinned on the assessment row only.
 *
 * Do not fall back to the client's intake-interview snapshot: advisor-cloned
 * question IDs in that blob differ from the live platform bank. Unpinned
 * assessments collect answers against live UUIDs; using the interview
 * snapshot at score time yields 0% completion (question-id mismatch).
 */
export async function loadSnapshotForAssessment(
  assessmentId: string,
): Promise<ParsedMethodologySnapshot | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { snapshotId: true },
  });
  if (!assessment?.snapshotId) return null;

  const row = await prisma.intakeSnapshot.findUnique({
    where: { id: assessment.snapshotId },
  });
  return row ? parseSnapshotRow(row) : null;
}

export function resolvePillarLabel(
  snapshot: MethodologySnapshotBlob,
  pillarSlug: string,
): string {
  const entry = snapshot.pillars.find((p) => p.slug === pillarSlug);
  if (!entry) return pillarSlug;
  return entry.displayName?.trim() || entry.canonicalName;
}

export function getActivePillars(snapshot: MethodologySnapshotBlob): string[] {
  return snapshot.includedPillarSlugs.length > 0
    ? snapshot.includedPillarSlugs
    : snapshot.pillars.filter((p) => p.isActive).map((p) => p.slug);
}

export function getPillarCountLabel(snapshot: MethodologySnapshotBlob): string {
  const n = getActivePillars(snapshot).length;
  return `${n} household risk domain${n === 1 ? "" : "s"}`;
}

export function getPillarWeightMap(
  snapshot: MethodologySnapshotBlob,
): Record<string, number> {
  const active = new Set(getActivePillars(snapshot));
  const out: Record<string, number> = {};
  for (const p of snapshot.pillars) {
    if (active.has(p.slug)) out[p.slug] = p.weight;
  }
  return out;
}

export function riskAreasFromSnapshot(snapshot: MethodologySnapshotBlob) {
  const active = new Set(getActivePillars(snapshot));
  return snapshot.pillars
    .filter((p) => active.has(p.slug))
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((p) => ({
      id: p.slug,
      name: resolvePillarLabel(snapshot, p.slug),
      summary: "",
    }));
}

export {
  buildAdvisorConfigSnapshot as buildSnapshot,
  loadSnapshotForAssessment as loadSnapshotByAssessmentId,
};
