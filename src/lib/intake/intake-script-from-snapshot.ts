import type { IntakeQuestion } from "@/lib/intake/types";
import type { SnapshotIntakeQuestion } from "@/lib/methodology/types";
import { intakeUsesFreeformResponse } from "@/lib/intake/intake-answer-behavior";

const DEFAULT_RECORDING_TIPS = [
  "Speak clearly and at a normal pace",
  "Include concrete examples when they help",
  "It's fine to pause and gather your thoughts",
];

function intakeAnswerFields(row: {
  answerType: string;
  answer0?: string | null;
  answer1?: string | null;
  answer2?: string | null;
  answer3?: string | null;
}) {
  return {
    answerType: row.answerType,
    answer0: row.answer0 ?? null,
    answer1: row.answer1 ?? null,
    answer2: row.answer2 ?? null,
    answer3: row.answer3 ?? null,
  };
}

export function snapshotRowToIntakeQuestion(
  row: SnapshotIntakeQuestion,
  index: number,
): IntakeQuestion {
  const tips = row.recommendedActions
    ? row.recommendedActions
        .split(/\n+|•|;/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8)
    : DEFAULT_RECORDING_TIPS;

  return {
    id: row.id,
    questionNumber: index + 1,
    questionText: row.questionText,
    ...intakeAnswerFields(row),
    whyThisMatters: row.helpText ?? undefined,
    recommendedActions: row.recommendedActions ?? undefined,
    relatedPillarIds:
      row.relatedPillarIds?.length > 0 ? [...row.relatedPillarIds] : undefined,
    context:
      row.context ??
      row.helpText ??
      "Take your time; speak naturally as if in conversation with your advisor.",
    recordingTips: intakeUsesFreeformResponse(row.answerType)
      ? tips.length
        ? tips
        : DEFAULT_RECORDING_TIPS
      : [],
  };
}

export function intakeQuestionsFromSnapshot(
  snapshot: { intakeQuestions: SnapshotIntakeQuestion[] },
): IntakeQuestion[] {
  return snapshot.intakeQuestions.map((row, i) => snapshotRowToIntakeQuestion(row, i));
}
