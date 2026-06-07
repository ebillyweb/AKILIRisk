import type { HouseholdProfile } from "@/lib/assessment/personalization";
import { ageFromBirthYear, getMembersByRole, hasMultipleGenerations, hasSuccessors } from "@/lib/assessment/personalization";
import type { BranchingPredicate, BranchingRule, Question } from "@/lib/assessment/types";

export type BranchingPredicateWire = BranchingPredicate;

export type GovernanceQuestionWire = {
  questionId: string;
  /** `null` for intake script pillar rows — not a scoring risk area. */
  riskAreaId: string | null;
  sortOrderGlobal: number;
  text: string;
  helpText: string | null;
  learnMore: string | null;
  riskRelevance: string | null;
  type: string;
  options: unknown;
  required: boolean;
  weight: number;
  scoreMap: Record<string, unknown>;
  branchingDependsOn: string | null;
  branchingPredicate: BranchingPredicateWire | null;
  profileConditionKey: string | null;
  omitMaturityScoreWhenYes: boolean;
};

export function branchingPredicateToRule(
  dependsOn: string,
  predicate: BranchingPredicateWire | null | undefined
): BranchingRule | undefined {
  if (!predicate || !dependsOn) return undefined;
  const { op, value } = predicate;
  if (op === "equals") {
    return {
      dependsOn,
      showIf: (answer: unknown) => answer === value,
    };
  }
  if (op === "gte") {
    const threshold = Number(value);
    return {
      dependsOn,
      showIf: (answer: unknown) => {
        const n = typeof answer === "number" ? answer : Number(answer);
        return Number.isFinite(n) && n >= threshold;
      },
    };
  }
  if (op === "answered") {
    return {
      dependsOn,
      showIf: (answer: unknown) =>
        answer !== undefined && answer !== null && answer !== "",
    };
  }
  return {
    dependsOn,
    showIf: (answer: unknown) => answer !== value,
  };
}

/** Keys stored on bank rows for household-profile gating (admin picklist). */
export const PROFILE_CONDITION_KEYS = [
  "young-dependent",
  "trustee-in-family",
  "generations-or-successors",
] as const;

const PROFILE_CONDITIONS: Record<
  (typeof PROFILE_CONDITION_KEYS)[number],
  (profile: HouseholdProfile) => boolean
> = {
  "young-dependent": (profile) =>
    // Round-11 commit 2.2: age derived from birthYear at read time.
    profile.members.some((m) => {
      const age = ageFromBirthYear(m.birthYear);
      return age !== null && age < 26;
    }),
  "trustee-in-family": (profile) =>
    profile.members.some((m) => m.governanceRoles.includes("TRUSTEE")),
  "generations-or-successors": (profile) =>
    hasMultipleGenerations(profile) || hasSuccessors(profile),
};

export function profileConditionForKey(
  key: string | null | undefined
): ((profile: HouseholdProfile) => boolean) | undefined {
  if (!key) return undefined;
  return PROFILE_CONDITIONS[key as (typeof PROFILE_CONDITION_KEYS)[number]];
}

const TEXT_TEMPLATE_BY_QUESTION_ID: Record<
  string,
  (profile: HouseholdProfile | null) => string
> = {
  // Round-11 commit 2.2 (BRD §5.1 amendment): personalization now uses
  // the auto-assigned `displayLabel` ("Member A", "Member B", …)
  // because fullName was dropped from HouseholdMember.
  "dma-05": (p) => {
    if (!p) {
      return "How does the primary decision maker communicate major financial decisions to the family?";
    }
    const dm = getMembersByRole(p, "DECISION_MAKER")[0];
    return dm
      ? `How does ${dm.displayLabel} communicate major financial decisions to the family?`
      : "How does the primary decision maker communicate major financial decisions to the family?";
  },
  "sp-02": (p) => {
    if (!p) {
      return "How prepared is your primary successor for leadership responsibility?";
    }
    const successor = getMembersByRole(p, "SUCCESSOR")[0];
    return successor
      ? `How prepared is ${successor.displayLabel} for leadership responsibility?`
      : "How prepared is your primary successor for leadership responsibility?";
  },
};

export function textTemplateForQuestionId(
  questionId: string
): ((profile: HouseholdProfile | null) => string) | undefined {
  return TEXT_TEMPLATE_BY_QUESTION_ID[questionId];
}

export function wireQuestionsToQuestions(wires: GovernanceQuestionWire[]): Question[] {
  return wires.map((w) => wireQuestionToQuestion(w));
}

export function wireQuestionToQuestion(wire: GovernanceQuestionWire): Question {
  if (wire.riskAreaId === null) {
    throw new Error(
      "wireQuestionToQuestion: intake script wires are not scoring questions; do not map them to Question"
    );
  }
  const branchingRule = branchingPredicateToRule(
    wire.branchingDependsOn ?? "",
    wire.branchingPredicate ?? undefined
  );
  const profileCondition = profileConditionForKey(wire.profileConditionKey);
  const textTemplate = textTemplateForQuestionId(wire.questionId);

  return {
    id: wire.questionId,
    text: wire.text,
    helpText: wire.helpText ?? undefined,
    learnMore: wire.learnMore ?? undefined,
    ...(wire.riskRelevance ? { riskRelevance: wire.riskRelevance } : {}),
    type: wire.type as Question["type"],
    options: (wire.options as Question["options"]) ?? undefined,
    required: wire.required,
    pillar: wire.riskAreaId,
    subCategory: wire.riskAreaId,
    weight: wire.weight,
    scoreMap: normalizeScoreMap(wire.scoreMap),
    ...(wire.omitMaturityScoreWhenYes ? { omitMaturityScoreWhenYes: true } : {}),
    ...(branchingRule ? { branchingRule } : {}),
    ...(wire.branchingDependsOn && wire.branchingPredicate
      ? {
          branchingDependsOn: wire.branchingDependsOn,
          branchingPredicate: wire.branchingPredicate,
        }
      : {}),
    ...(profileCondition ? { profileCondition } : {}),
    ...(textTemplate ? { textTemplate } : {}),
  };
}

function normalizeScoreMap(raw: Record<string, unknown>): Record<string | number, number> {
  const out: Record<string | number, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = /^\d+$/.test(k) ? Number(k) : k;
    out[key] = typeof v === "number" ? v : Number(v);
  }
  return out;
}
