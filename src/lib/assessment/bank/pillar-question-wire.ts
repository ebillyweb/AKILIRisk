import type { PillarCategory, PillarQuestion, PillarSection } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { BranchingPredicateWire, GovernanceQuestionWire } from "./behaviors";
import { riskAreaIdForPillarCategory } from "./pillar-category-risk-area";

export type PillarQuestionWithHierarchy = PillarQuestion & {
  section: PillarSection & { category: PillarCategory };
};

export const pillarQuestionInclude = {
  section: { include: { category: true } },
} satisfies Prisma.PillarQuestionInclude;

function cleanLabel(s: string | null | undefined, fallback: string): string {
  const t = (s ?? "").trim();
  return t || fallback;
}

function wireForScored03(row: PillarQuestionWithHierarchy): GovernanceQuestionWire {
  const a0 = cleanLabel(row.answer0, "0");
  const a1 = cleanLabel(row.answer1, "1");
  const a2 = cleanLabel(row.answer2, "2");
  const a3 = cleanLabel(row.answer3, "3");
  const options = [0, 1, 2, 3].map((value) => ({
    value,
    label: [a0, a1, a2, a3][value] ?? `Level ${value}`,
  }));
  return {
    questionId: row.id,
    riskAreaId: riskAreaIdForPillarCategory(row.section.category),
    sortOrderGlobal: 0,
    text: row.questionText,
    helpText: row.whyThisMatters,
    learnMore: row.recommendedActions,
    riskRelevance: row.whyThisMatters,
    type: "maturity-scale",
    options,
    required: true,
    weight: row.section.weightPct ?? 2,
    scoreMap: { 0: 0, 1: 1, 2: 2, 3: 3 },
    branchingDependsOn: null,
    branchingPredicate: null,
    profileConditionKey: null,
    omitMaturityScoreWhenYes: false,
  };
}

/**
 * 5-point Likert wire (BRD §4.1).
 *
 * Distinct from `scale_1_5` in that the answer values are anchored to the
 * standard "Strongly disagree → Strongly agree" continuum, the renderer is
 * the horizontal `LikertScale` pip group, and the default scoreMap
 * collapses 1–5 onto the 0–3 maturity scale via `normalizeAnswerToMaturity`
 * (5 → 3.0, 1 → 0.0). Existing `scale_1_5` rows are NOT auto-flipped to
 * Likert — admins re-author intentionally if the legacy semantics drift.
 *
 * Negatively-keyed Likert items use the inverted `{1:5,2:4,3:3,4:2,5:1}`
 * scoreMap; the renderer is unchanged.
 */
function wireForLikert5(row: PillarQuestionWithHierarchy): GovernanceQuestionWire {
  return {
    questionId: row.id,
    riskAreaId: riskAreaIdForPillarCategory(row.section.category),
    sortOrderGlobal: 0,
    text: row.questionText,
    helpText: row.whyThisMatters,
    learnMore: row.recommendedActions,
    riskRelevance: row.whyThisMatters,
    type: "likert",
    options: null,
    required: true,
    weight: row.section.weightPct ?? 2,
    scoreMap: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 },
    branchingDependsOn: null,
    branchingPredicate: null,
    profileConditionKey: null,
    omitMaturityScoreWhenYes: false,
  };
}

function wireForScale15(row: PillarQuestionWithHierarchy): GovernanceQuestionWire {
  const labels = [
    cleanLabel(row.answer0, "1"),
    cleanLabel(row.answer1, "2"),
    cleanLabel(row.answer2, "3"),
    cleanLabel(row.answer3, "4–5"),
  ];
  const options = [1, 2, 3, 4, 5].map((value, i) => ({
    value: String(value),
    label: String(value),
    description: labels[Math.min(i, labels.length - 1)] ?? String(value),
  }));
  return {
    questionId: row.id,
    riskAreaId: riskAreaIdForPillarCategory(row.section.category),
    sortOrderGlobal: 0,
    text: row.questionText,
    helpText: row.whyThisMatters,
    learnMore: row.recommendedActions,
    riskRelevance: row.whyThisMatters,
    type: "single-choice",
    options,
    required: true,
    weight: row.section.weightPct ?? 2,
    scoreMap: { "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 },
    branchingDependsOn: null,
    branchingPredicate: null,
    profileConditionKey: null,
    omitMaturityScoreWhenYes: false,
  };
}

function wireForYesNo(row: PillarQuestionWithHierarchy): GovernanceQuestionWire {
  return {
    questionId: row.id,
    riskAreaId: riskAreaIdForPillarCategory(row.section.category),
    sortOrderGlobal: 0,
    text: row.questionText,
    helpText: row.whyThisMatters,
    learnMore: row.recommendedActions,
    riskRelevance: row.whyThisMatters,
    type: "yes-no",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    required: true,
    weight: row.section.weightPct ?? 2,
    scoreMap: { yes: 3, no: 0 },
    branchingDependsOn: null,
    branchingPredicate: null,
    profileConditionKey: null,
    omitMaturityScoreWhenYes: false,
  };
}

function wireForFillable(row: PillarQuestionWithHierarchy): GovernanceQuestionWire {
  return {
    questionId: row.id,
    riskAreaId: riskAreaIdForPillarCategory(row.section.category),
    sortOrderGlobal: 0,
    text: row.questionText,
    helpText: row.whyThisMatters,
    learnMore: row.recommendedActions,
    riskRelevance: row.whyThisMatters,
    type: "short-text",
    options: null,
    required: true,
    weight: row.section.weightPct ?? 1,
    scoreMap: {},
    branchingDependsOn: null,
    branchingPredicate: null,
    profileConditionKey: null,
    omitMaturityScoreWhenYes: false,
  };
}

function wireForNumber(row: PillarQuestionWithHierarchy): GovernanceQuestionWire {
  return {
    questionId: row.id,
    riskAreaId: riskAreaIdForPillarCategory(row.section.category),
    sortOrderGlobal: 0,
    text: row.questionText,
    helpText: row.whyThisMatters,
    learnMore: row.recommendedActions,
    riskRelevance: row.whyThisMatters,
    type: "numeric",
    options: null,
    required: true,
    weight: row.section.weightPct ?? 1,
    scoreMap: {},
    branchingDependsOn: null,
    branchingPredicate: null,
    profileConditionKey: null,
    omitMaturityScoreWhenYes: false,
  };
}

function wireForDate(row: PillarQuestionWithHierarchy): GovernanceQuestionWire {
  return {
    questionId: row.id,
    riskAreaId: riskAreaIdForPillarCategory(row.section.category),
    sortOrderGlobal: 0,
    text: row.questionText,
    helpText: row.whyThisMatters ?? "Use MM/YYYY format where possible.",
    learnMore: row.recommendedActions,
    riskRelevance: row.whyThisMatters,
    type: "short-text",
    options: null,
    required: true,
    weight: row.section.weightPct ?? 1,
    scoreMap: {},
    branchingDependsOn: null,
    branchingPredicate: null,
    profileConditionKey: null,
    omitMaturityScoreWhenYes: false,
  };
}

export function pillarQuestionRowToWire(row: PillarQuestionWithHierarchy): GovernanceQuestionWire {
  switch (row.answerType) {
    case "yes_no":
      return wireForYesNo(row);
    case "fillable":
      return wireForFillable(row);
    case "number":
      return wireForNumber(row);
    case "date_mm_yyyy":
      return wireForDate(row);
    case "scale_1_5":
      return wireForScale15(row);
    case "likert_5":
      return wireForLikert5(row);
    case "scored_0_3":
    default:
      return wireForScored03(row);
  }
}

export function assignSortOrderGlobals(wires: GovernanceQuestionWire[]): GovernanceQuestionWire[] {
  return wires.map((w, i) => ({ ...w, sortOrderGlobal: i }));
}

/** Belvedere sub-question ids: `A1a` → parent `A1`, `A3b` → `A3`. */
export function parentQuestionNumberForSub(questionNumber: string): string | null {
  const match = questionNumber.match(/^([A-Za-z]*\d+)([a-z]+)$/);
  return match?.[1] ?? null;
}

function subQuestionBranchingPredicate(
  parent: PillarQuestionWithHierarchy
): BranchingPredicateWire {
  if (parent.answerType === "scored_0_3" || parent.answerType === "scale_1_5") {
    return { op: "gte", value: 2 };
  }
  if (parent.answerType === "yes_no") {
    return { op: "equals", value: "yes" };
  }
  return { op: "answered" };
}

/**
 * Sub-questions (e.g. A1a) must not appear before their parent (A1), even when
 * admin reorder or seed drift swaps `display_order`.
 */
export function applySubQuestionBranching(
  rows: PillarQuestionWithHierarchy[],
  wires: GovernanceQuestionWire[]
): GovernanceQuestionWire[] {
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const idBySectionAndNumber = new Map<string, string>();
  for (const row of rows) {
    if (row.questionNumber) {
      idBySectionAndNumber.set(`${row.sectionId}:${row.questionNumber}`, row.id);
    }
  }

  return wires.map((wire) => {
    const row = rowById.get(wire.questionId);
    if (!row?.isSubQuestion || !row.questionNumber) return wire;

    const parentNumber = parentQuestionNumberForSub(row.questionNumber);
    if (!parentNumber) return wire;

    const parentId = idBySectionAndNumber.get(`${row.sectionId}:${parentNumber}`);
    if (!parentId) return wire;

    const parentRow = rowById.get(parentId);
    if (!parentRow) return wire;

    return {
      ...wire,
      branchingDependsOn: parentId,
      branchingPredicate: subQuestionBranchingPredicate(parentRow),
    };
  });
}

function pillarQuestionSortKey(
  row: PillarQuestionWithHierarchy,
  parentOrderBySectionAndNumber: Map<string, number>
): number {
  if (!row.isSubQuestion || !row.questionNumber) return row.displayOrder;
  const parentNumber = parentQuestionNumberForSub(row.questionNumber);
  if (!parentNumber) return row.displayOrder;
  const parentOrder = parentOrderBySectionAndNumber.get(`${row.sectionId}:${parentNumber}`);
  if (parentOrder === undefined) return row.displayOrder;
  // Sub-questions follow their parent even when admin reorder swaps display_order.
  return parentOrder + 0.001;
}

export function sortPillarQuestionRows(
  rows: PillarQuestionWithHierarchy[]
): PillarQuestionWithHierarchy[] {
  const parentOrderBySectionAndNumber = new Map<string, number>();
  for (const row of rows) {
    if (!row.isSubQuestion && row.questionNumber) {
      parentOrderBySectionAndNumber.set(
        `${row.sectionId}:${row.questionNumber}`,
        row.displayOrder
      );
    }
  }

  return [...rows].sort((a, b) => {
    const ca = a.section.category.displayOrder - b.section.category.displayOrder;
    if (ca !== 0) return ca;
    const cc = a.section.category.code.localeCompare(b.section.category.code);
    if (cc !== 0) return cc;
    const sa = a.section.displayOrder - b.section.displayOrder;
    if (sa !== 0) return sa;
    const sc = a.section.code.localeCompare(b.section.code);
    if (sc !== 0) return sc;
    const ka = pillarQuestionSortKey(a, parentOrderBySectionAndNumber);
    const kb = pillarQuestionSortKey(b, parentOrderBySectionAndNumber);
    if (ka !== kb) return ka - kb;
    return a.displayOrder - b.displayOrder;
  });
}
