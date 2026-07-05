import "server-only";

import { PillarCategoryKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { IntakeQuestion } from "@/lib/intake/types";
import { INTAKE_QUESTIONS } from "@/lib/intake/questions";
import {
  pillarQuestionInclude,
  sortPillarQuestionRows,
  type PillarQuestionWithHierarchy,
} from "@/lib/assessment/bank/pillar-question-wire";
import { intakeQuestionsFromSnapshot } from "@/lib/intake/intake-script-from-snapshot";
import {
  ensureAdvisorDefaultsCloned,
  getAssignedAdvisorProfileIdForClient,
  loadSnapshotForInterview,
} from "@/lib/methodology/snapshot";
import { filterIntakeQuestionsByBankMode } from "@/lib/methodology/intake-question-bank-mode";
import { normalizeIntakeAnswerType, intakeUsesFreeformResponse } from "@/lib/intake/intake-answer-behavior";
import { resolveAdvisorIntakeQuestionBankMode } from "@/lib/methodology/intake-question-bank-mode.server";

const DEFAULT_RECORDING_TIPS = [
  "Speak clearly and at a normal pace",
  "Include concrete examples when they help",
  "It's fine to pause and gather your thoughts",
];

function recordingTipsFromRow(row: PillarQuestionWithHierarchy): string[] {
  const ra = row.recommendedActions?.trim();
  if (ra) {
    const parts = ra.split(/\n+|•|;/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts.slice(0, 8);
  }
  return DEFAULT_RECORDING_TIPS;
}

function pillarRowsToIntakeQuestions(rows: PillarQuestionWithHierarchy[]): IntakeQuestion[] {
  const sorted = sortPillarQuestionRows(rows);
  return sorted.map((row, i) => {
    const why = row.whyThisMatters?.trim();
    const recommended = row.recommendedActions?.trim();
    const related =
      row.relatedPillarIds?.length > 0 ? [...row.relatedPillarIds] : undefined;
    return {
      id: row.id,
      questionNumber: i + 1,
      questionText: row.questionText,
      answerType: normalizeIntakeAnswerType(row.answerType),
      answer0: row.answer0,
      answer1: row.answer1,
      answer2: row.answer2,
      answer3: row.answer3,
      whyThisMatters: why || undefined,
      recommendedActions: recommended || undefined,
      relatedPillarIds: related,
      context:
        why ||
        "Take your time; speak naturally as if in conversation with your advisor.",
      recordingTips: intakeUsesFreeformResponse(row.answerType)
        ? recordingTipsFromRow(row)
        : [],
    };
  });
}

/** Visible advisor-owned intake script (after platform sync). */
export async function loadAdvisorIntakeScriptQuestions(
  advisorProfileId: string,
): Promise<IntakeQuestion[]> {
  await ensureAdvisorDefaultsCloned(advisorProfileId);
  const [mode, rows] = await Promise.all([
    resolveAdvisorIntakeQuestionBankMode(advisorProfileId),
    prisma.advisorIntakeQuestion.findMany({
      where: { advisorProfileId, isVisible: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);
  const activeRows = filterIntakeQuestionsByBankMode(rows, mode);
  if (activeRows.length === 0) return [];

  return activeRows.map((row, i) => {
    const context =
      row.context?.trim() ||
      row.helpText?.trim() ||
      "Take your time; speak naturally as if in conversation with your advisor.";
    const recommended = row.recommendedActions?.trim();
    const tips = recommended
      ? recommended
          .split(/\n+|•|;/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8)
      : DEFAULT_RECORDING_TIPS;

    return {
      id: row.id,
      questionNumber: i + 1,
      questionText: row.questionText,
      answerType: normalizeIntakeAnswerType(row.answerType),
      answer0: row.answer0,
      answer1: row.answer1,
      answer2: row.answer2,
      answer3: row.answer3,
      whyThisMatters: row.helpText ?? row.context ?? undefined,
      recommendedActions: recommended || undefined,
      relatedPillarIds:
        row.relatedPillarIds?.length > 0 ? [...row.relatedPillarIds] : undefined,
      context,
      recordingTips: intakeUsesFreeformResponse(row.answerType)
        ? tips.length
          ? tips
          : DEFAULT_RECORDING_TIPS
        : [],
    };
  });
}

async function loadAdvisorIntakeScriptForUser(userId: string): Promise<IntakeQuestion[]> {
  const advisorProfileId = await getAssignedAdvisorProfileIdForClient(userId);
  if (!advisorProfileId) return [];
  return loadAdvisorIntakeScriptQuestions(advisorProfileId);
}

/**
 * Ordered intake script for the audio interview: visible rows in the platform intake bank
 * (`questions` / category `INTAKE`). If none match, returns legacy `INTAKE_QUESTIONS` (TypeScript).
 */
export async function loadIntakeScriptQuestions(): Promise<IntakeQuestion[]> {
  try {
    const rows = (await prisma.pillarQuestion.findMany({
      where: {
        isVisible: true,
        section: { category: { kind: PillarCategoryKind.INTAKE } },
      },
      include: pillarQuestionInclude,
    })) as PillarQuestionWithHierarchy[];

    if (rows.length === 0) {
      return INTAKE_QUESTIONS;
    }

    return pillarRowsToIntakeQuestions(rows);
  } catch (e) {
    console.warn("[loadIntakeScriptQuestions] falling back to static list:", e);
    return INTAKE_QUESTIONS;
  }
}

/** Load intake script for a client interview (snapshot-first). */
export async function loadIntakeScriptForInterview(
  interviewId: string,
): Promise<IntakeQuestion[]> {
  const snapshot = await loadSnapshotForInterview(interviewId);
  if (snapshot?.intakeQuestions?.length) {
    return intakeQuestionsFromSnapshot(snapshot);
  }

  const interview = await prisma.intakeInterview.findUnique({
    where: { id: interviewId },
    select: { userId: true },
  });
  if (interview) {
    const advisorScript = await loadAdvisorIntakeScriptForUser(interview.userId);
    if (advisorScript.length > 0) return advisorScript;
  }

  return loadIntakeScriptQuestions();
}

/** Resolve script for a client user (latest in-flight or active interview). */
export async function loadIntakeScriptForClient(
  userId: string,
  interviewId?: string,
): Promise<IntakeQuestion[]> {
  if (interviewId) {
    return loadIntakeScriptForInterview(interviewId);
  }
  const interview = await prisma.intakeInterview.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (interview) {
    return loadIntakeScriptForInterview(interview.id);
  }

  const advisorScript = await loadAdvisorIntakeScriptForUser(userId);
  if (advisorScript.length > 0) return advisorScript;

  return loadIntakeScriptQuestions();
}
