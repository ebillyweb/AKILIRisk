import type { Question } from "./types";

/** Pick the lowest-maturity option for each visible question (yes-no → "no"). */
export function buildLowestMaturityAnswers(
  questions: Question[],
  visibleIds: string[]
): Record<string, unknown> {
  const visible = new Set(visibleIds);
  const answers: Record<string, unknown> = {};

  for (const question of questions) {
    if (!visible.has(question.id)) continue;

    if (question.type === "yes-no") {
      answers[question.id] = "no";
      continue;
    }

    if (question.type === "maturity-scale" && question.options?.length) {
      let worst = question.options[0];
      let worstScore = Number(question.scoreMap[String(worst.value)] ?? Infinity);
      for (const opt of question.options) {
        const raw = Number(question.scoreMap[String(opt.value)] ?? Infinity);
        if (raw < worstScore) {
          worst = opt;
          worstScore = raw;
        }
      }
      answers[question.id] = worst.value;
      continue;
    }

    if (question.options?.length) {
      let worst = question.options[0];
      let worstScore = Number(question.scoreMap[String(worst.value)] ?? Infinity);
      for (const opt of question.options) {
        const raw = Number(question.scoreMap[String(opt.value)] ?? Infinity);
        if (raw < worstScore) {
          worst = opt;
          worstScore = raw;
        }
      }
      answers[question.id] = worst.value;
    }
  }

  return answers;
}
