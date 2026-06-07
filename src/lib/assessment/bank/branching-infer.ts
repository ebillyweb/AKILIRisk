import { resolveBranchingRule } from "@/lib/assessment/branching";
import type { Question } from "@/lib/assessment/types";
import type { BranchingPredicateWire } from "./behaviors";

/**
 * Collect representative answer values for the parent question to infer branching predicates.
 */
export function collectCandidateValues(depQuestion: Question | undefined): unknown[] {
  if (!depQuestion?.options?.length) {
    return ["yes", "no", 0, 1, 2, 3];
  }
  const fromOptions = depQuestion.options.map((o) => o.value);
  const extras: unknown[] = [];
  if (depQuestion.type === "yes-no") {
    extras.push("yes", "no");
  }
  if (depQuestion.type === "maturity-scale") {
    extras.push(0, 1, 2, 3);
  }
  return [...new Set([...fromOptions, ...extras])];
}

function safeShowIf(showIf: (a: unknown) => boolean, value: unknown): boolean {
  try {
    return showIf(value);
  } catch {
    return false;
  }
}

/**
 * Encode branchingRule.showIf as equals / notEquals against a single test value.
 */
export function inferBranchingPayload(
  question: Question,
  questionsById: Map<string, Question>
): { dependsOn: string; predicate: BranchingPredicateWire } | null {
  const br = resolveBranchingRule(question);
  if (!br) return null;

  const dep = questionsById.get(br.dependsOn);
  const candidates = collectCandidateValues(dep);
  const outcomes = candidates.map((v) => ({
    v,
    ok: safeShowIf(br.showIf, v),
  }));

  const trueCount = outcomes.filter((o) => o.ok).length;
  const falseCount = outcomes.length - trueCount;

  if (trueCount === 1 && falseCount > 0) {
    const v = outcomes.find((o) => o.ok)!.v;
    return { dependsOn: br.dependsOn, predicate: { op: "equals", value: v } };
  }

  if (falseCount === 1 && trueCount > 0) {
    const v = outcomes.find((o) => !o.ok)!.v;
    return { dependsOn: br.dependsOn, predicate: { op: "notEquals", value: v } };
  }

  throw new Error(
    `Cannot infer branching for question ${question.id}: ambiguous outcomes (${trueCount} true / ${falseCount} false of ${candidates.length})`
  );
}

const PROFILE_KEY_BY_QUESTION_ID: Record<string, string> = {
  "phys-04": "young-dependent",
  "teg-03": "trustee-in-family",
  "sp-02": "generations-or-successors",
};

export function profileConditionKeyForQuestion(question: Question): string | null {
  return PROFILE_KEY_BY_QUESTION_ID[question.id] ?? null;
}
