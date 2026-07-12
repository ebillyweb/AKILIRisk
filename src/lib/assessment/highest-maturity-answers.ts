import type { Question } from "./types";

/** Pick the highest-maturity option for each visible question (yes-no → "yes"). */
export function buildHighestMaturityAnswers(
  questions: Question[],
  visibleIds: string[]
): Record<string, unknown> {
  const visible = new Set(visibleIds);
  const answers: Record<string, unknown> = {};

  for (const question of questions) {
    if (!visible.has(question.id)) continue;

    // Multi-choice is informational (unscored) and array-valued — it has no
    // maturity band, so it is not part of a lowest/highest-maturity simulation.
    if (question.type === "multi-choice") continue;

    if (question.type === "yes-no") {
      answers[question.id] = "yes";
      continue;
    }

    if (question.type === "maturity-scale" && question.options?.length) {
      let best = question.options[0];
      let bestScore = Number(question.scoreMap[String(best.value)] ?? -Infinity);
      for (const opt of question.options) {
        const raw = Number(question.scoreMap[String(opt.value)] ?? -Infinity);
        if (raw > bestScore) {
          best = opt;
          bestScore = raw;
        }
      }
      answers[question.id] = best.value;
      continue;
    }

    if (question.options?.length) {
      let best = question.options[0];
      let bestScore = Number(question.scoreMap[String(best.value)] ?? -Infinity);
      for (const opt of question.options) {
        const raw = Number(question.scoreMap[String(opt.value)] ?? -Infinity);
        if (raw > bestScore) {
          best = opt;
          bestScore = raw;
        }
      }
      answers[question.id] = best.value;
    }
  }

  return answers;
}
