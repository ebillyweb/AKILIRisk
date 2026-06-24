import type { IntakeQuestion } from "@/lib/intake/types";
import type { MethodologySnapshotBlob, SnapshotIntakeQuestion } from "@/lib/methodology/types";

const DEFAULT_RECORDING_TIPS = [
  "Speak clearly and at a normal pace",
  "Include concrete examples when they help",
  "It's fine to pause and gather your thoughts",
];

export function intakeQuestionsFromSnapshot(
  snapshot: MethodologySnapshotBlob,
): IntakeQuestion[] {
  return snapshot.intakeQuestions.map((row, i) => snapshotRowToIntakeQuestion(row, i));
}

function snapshotRowToIntakeQuestion(
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
    questionNumber: row.questionNumber ? Number(row.questionNumber) || index + 1 : index + 1,
    questionText: row.questionText,
    whyThisMatters: row.helpText ?? undefined,
    recommendedActions: row.recommendedActions ?? undefined,
    relatedPillarIds:
      row.relatedPillarIds?.length > 0 ? [...row.relatedPillarIds] : undefined,
    context:
      row.context ??
      row.helpText ??
      "Take your time; speak naturally as if in conversation with your advisor.",
    recordingTips: tips.length ? tips : DEFAULT_RECORDING_TIPS,
  };
}
