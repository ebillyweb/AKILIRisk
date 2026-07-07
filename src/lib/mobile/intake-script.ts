import { INTAKE_QUESTIONS } from "@/lib/intake/questions";

export interface MobileIntakeQuestion {
  id: string;
  order: number;
  pillar: string;
  prompt: string;
  helpText: string | null;
  allowVoice: boolean;
}

/**
 * Projects the code-defined intake question bank into the shape the mobile
 * app expects (plan §4.2). The intake interview is governance-focused, so
 * questions are tagged accordingly; this can be refined per-question later.
 */
export function getMobileIntakeQuestions(): MobileIntakeQuestion[] {
  return INTAKE_QUESTIONS.map((q) => ({
    id: q.id,
    order: q.questionNumber - 1,
    pillar: "governance",
    prompt: q.questionText,
    helpText: q.context ?? null,
    allowVoice: true,
  }));
}
