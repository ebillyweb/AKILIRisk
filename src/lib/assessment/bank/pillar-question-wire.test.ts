/**
 * F1 / BRD §4.1 — workbook wire dispatch test for the new
 * `likert_5` answerType. Pins the contract:
 *   - dispatch picks the Likert wire when answerType === "likert_5"
 *   - wired type === "likert", scoreMap === { 1..5 }
 *   - existing `scale_1_5` rows continue to wire as `single-choice`
 *     (NOT auto-flipped to Likert — admins re-author intentionally)
 *   - the standard wire fields (text, helpText, learnMore, weight,
 *     riskAreaId from the section's category) plumb through unchanged
 */

import { describe, it, expect } from "vitest";
import { PillarCategoryKind } from "@prisma/client";
import {
  applySubQuestionBranching,
  parentQuestionNumberForSub,
  pillarQuestionRowToWire,
  sortPillarQuestionRows,
} from "./pillar-question-wire";
import type { PillarQuestionWithHierarchy } from "./pillar-question-wire";
import { wireQuestionToQuestion } from "./behaviors";
import { getVisibleQuestions } from "@/lib/assessment/branching";

function makeRow(
  answerType: string,
  overrides: Partial<PillarQuestionWithHierarchy> = {},
): PillarQuestionWithHierarchy {
  // Build a minimally complete PillarQuestion + section + category tree
  // sufficient for the wire dispatch path. All fields the wire helpers
  // touch are populated; the rest are typed-loosely as the runtime never
  // reads them in this code path.
  return {
    id: "q-likert-1",
    sectionId: "sec-1",
    questionNumber: "L1",
    questionText: "I have a documented family decision-making protocol.",
    answerType,
    answer0: null,
    answer1: null,
    answer2: null,
    answer3: null,
    whyThisMatters: "Surfaces governance maturity.",
    recommendedActions: "Document and review annually.",
    isFollowUp: false,
    parentRef: null,
    displayOrder: 1,
    isVisible: true,
    section: {
      id: "sec-1",
      categoryId: "cat-1",
      code: "L1",
      title: "Likert section",
      displayOrder: 1,
      weightPct: 4,
      category: {
        id: "cat-1",
        code: "1_governance",
        kind: PillarCategoryKind.ASSESSMENT,
        displayOrder: 1,
        title: "Governance",
      },
    },
    ...overrides,
  } as unknown as PillarQuestionWithHierarchy;
}

describe("pillarQuestionRowToWire — likert_5 (F1 / BRD §4.1)", () => {
  it("dispatches to the Likert wire when answerType is likert_5", () => {
    const wire = pillarQuestionRowToWire(makeRow("likert_5"));
    expect(wire.type).toBe("likert");
  });

  it("emits the canonical 1..5 scoreMap", () => {
    const wire = pillarQuestionRowToWire(makeRow("likert_5"));
    expect(wire.scoreMap).toEqual({ "1": 1, "2": 2, "3": 3, "4": 4, "5": 5 });
  });

  it("plumbs riskAreaId from the section's category code", () => {
    const wire = pillarQuestionRowToWire(makeRow("likert_5"));
    expect(wire.riskAreaId).toBe("governance");
  });

  it("plumbs text, helpText, learnMore, riskRelevance, weight", () => {
    const wire = pillarQuestionRowToWire(makeRow("likert_5"));
    expect(wire.text).toBe("I have a documented family decision-making protocol.");
    expect(wire.helpText).toBe("Surfaces governance maturity.");
    expect(wire.learnMore).toBe("Document and review annually.");
    expect(wire.riskRelevance).toBe("Surfaces governance maturity.");
    expect(wire.weight).toBe(4);
  });

  it("emits null options (renderer hard-codes the 5 anchors)", () => {
    const wire = pillarQuestionRowToWire(makeRow("likert_5"));
    expect(wire.options).toBeNull();
  });

  it("does NOT auto-flip legacy scale_1_5 rows to Likert", () => {
    // Critical regression guard: existing workbook rows with
    // answerType === "scale_1_5" must continue to wire as
    // single-choice (current production semantics). Auto-flipping
    // would silently change scoring on every existing question.
    const wire = pillarQuestionRowToWire(makeRow("scale_1_5"));
    expect(wire.type).toBe("single-choice");
    expect(wire.type).not.toBe("likert");
  });

  it("falls back to scored_0_3 for unknown answerType", () => {
    const wire = pillarQuestionRowToWire(makeRow("unknown_type"));
    expect(wire.type).toBe("maturity-scale");
  });
});

describe("pillarQuestionRowToWire — fillable document upload", () => {
  it("wires document-attachment fillables as document-upload", () => {
    const wire = pillarQuestionRowToWire(
      makeRow("fillable", {
        questionText:
          "Please attach copies of any relevant supporting documentation, if available.",
      })
    );
    expect(wire.type).toBe("document-upload");
    expect(wire.required).toBe(false);
  });

  it("wires other fillables as short-text", () => {
    const wire = pillarQuestionRowToWire(
      makeRow("fillable", { questionText: "Describe these meetings" })
    );
    expect(wire.type).toBe("short-text");
  });
});

describe("sub-question branching (A1 / A1a)", () => {
  it("resolves parent question numbers from sub ids", () => {
    expect(parentQuestionNumberForSub("A1a")).toBe("A1");
    expect(parentQuestionNumberForSub("A3c")).toBe("A3");
    expect(parentQuestionNumberForSub("A1")).toBeNull();
  });

  it("hides A1a until A1 is answered at documented maturity (>= 2)", () => {
    const parent = makeRow("scored_0_3", {
      id: "parent-a1",
      questionNumber: "A1",
      questionText: "How have you documented your family mission?",
      isSubQuestion: false,
      displayOrder: 2,
    });
    const sub = makeRow("fillable", {
      id: "sub-a1a",
      questionNumber: "A1a",
      questionText:
        "Please attach copies of any relevant supporting documentation, if available.",
      isSubQuestion: true,
      displayOrder: 1,
    });
    const rows = [sub, parent] as PillarQuestionWithHierarchy[];
    const sorted = sortPillarQuestionRows(rows);
    const wired = applySubQuestionBranching(
      sorted,
      sorted.map(pillarQuestionRowToWire)
    );
    const questions = wired.map(wireQuestionToQuestion);

    const beforeParent = getVisibleQuestions({}, questions);
    expect(beforeParent.map((q) => q.text)).toEqual([
      "How have you documented your family mission?",
    ]);

    const afterDocumented = getVisibleQuestions({ [parent.id]: 2 }, questions);
    expect(afterDocumented.map((q) => q.text)).toEqual([
      "How have you documented your family mission?",
      "Please attach copies of any relevant supporting documentation, if available.",
    ]);
    expect(afterDocumented[1]?.type).toBe("document-upload");

    const afterScore3 = getVisibleQuestions({ [parent.id]: 3 }, questions);
    expect(afterScore3.map((q) => q.text)).toContain(
      "Please attach copies of any relevant supporting documentation, if available."
    );

    const afterScore1 = getVisibleQuestions({ [parent.id]: 1 }, questions);
    expect(afterScore1.map((q) => q.text)).not.toContain(
      "Please attach copies of any relevant supporting documentation, if available."
    );
  });
});
