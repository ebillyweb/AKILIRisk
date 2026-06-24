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
import { loadSnapshotForInterview } from "@/lib/methodology/snapshot";

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

/**
 * Ordered intake script for the audio interview: `questions` rows in category `INTAKE`
 * with `is_visible` true (e.g. demographic / DEM section defaults to hidden in pillar seed;
 * admins can show rows again). If none match, returns legacy `INTAKE_QUESTIONS` (TypeScript).
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
        whyThisMatters: why || undefined,
        recommendedActions: recommended || undefined,
        relatedPillarIds: related,
        context:
          why ||
          "Take your time; speak naturally as if in conversation with your advisor.",
        recordingTips: recordingTipsFromRow(row),
      };
    });
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
  return loadIntakeScriptQuestions();
}
