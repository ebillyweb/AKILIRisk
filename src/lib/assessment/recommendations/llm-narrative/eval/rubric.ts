/**
 * Phase 0 eval harness — rubric.
 *
 * Scores a generated narrative against two layers:
 *   1. Deterministic checks (no API key) — grounding (reuses validateNarrativeOutput),
 *      structure, coverage, and a specificity heuristic. These are the hard,
 *      compliance-critical gates.
 *   2. An optional LLM-as-judge (pluggable) — subjective dimensions (faithfulness,
 *      specificity, tone, actionability) scored 1–5. The harness provides the judge
 *      prompt + schema; the caller wires it to OpenAI/Anthropic. Absent a judge,
 *      the deterministic layer alone still produces a usable score.
 *
 * A case FAILS the hard gate — regardless of judge scores — if it isn't grounded
 * or doesn't cover every selected service. That mirrors the runtime posture:
 * ungrounded output is discarded in favor of static copy.
 */

import {
  validateNarrativeOutput,
  type NarrativeInput,
  type NarrativeOutput,
} from "../shape-a-prompt";

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic scoring
// ─────────────────────────────────────────────────────────────────────────────

export type DeterministicScore = {
  /** Passes the grounding validator (no hallucinated ids, exact coverage, real cites). */
  grounded: boolean;
  groundingReasons: string[];
  /** Headline/rationale/action shape is within spec. */
  structureOk: boolean;
  structureReasons: string[];
  /** Fraction of selected services that got a recommendation (want 1). */
  coverage: number;
  /** 0–1 heuristic: fraction of recs whose rationale echoes their cited findings. */
  specificity: number;
};

const STOPWORDS = new Set(
  "a an the of to and or is are be been for on in with your you their this that not no any across only when where which who whom while into out over under between per via as at by from up down".split(
    " ",
  ),
);

function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
  );
}

export function scoreDeterministic(
  input: NarrativeInput,
  output: NarrativeOutput,
): DeterministicScore {
  const grounding = validateNarrativeOutput(output, input);

  const selectedIds = input.selectedServices.map((s) => s.serviceId);
  const covered = new Set(output.recommendations.map((r) => r.serviceId));
  const coverage = selectedIds.length
    ? selectedIds.filter((id) => covered.has(id)).length / selectedIds.length
    : 0;

  // Structure checks that go beyond the runtime validator.
  const structureReasons: string[] = [];
  if (output.pillarSummary.split(/[.!?]+/).filter((s) => s.trim()).length > 4) {
    structureReasons.push("pillarSummary longer than ~4 sentences.");
  }
  for (const r of output.recommendations) {
    if (r.headline.trim().split(/\s+/).length > 10) {
      structureReasons.push(`${r.serviceId}: headline > 10 words.`);
    }
    const sentences = r.rationale.split(/[.!?]+/).filter((s) => s.trim()).length;
    if (sentences < 1 || sentences > 4) {
      structureReasons.push(`${r.serviceId}: rationale not 1–4 sentences.`);
    }
  }

  // Specificity: does each rationale actually echo the client's cited findings?
  const findingTokens = new Map<string, Set<string>>();
  for (const f of input.weakFindings) {
    findingTokens.set(f.questionNumber, contentTokens(`${f.questionText} ${f.chosenLabel}`));
  }
  let echoed = 0;
  for (const r of output.recommendations) {
    const rat = contentTokens(r.rationale);
    const cited = r.citedFindings.flatMap((c) => [...(findingTokens.get(c) ?? new Set<string>())]);
    if (cited.some((t) => rat.has(t))) echoed++;
  }
  const specificity = output.recommendations.length
    ? echoed / output.recommendations.length
    : 0;

  return {
    grounded: grounding.ok,
    groundingReasons: grounding.reasons,
    structureOk: structureReasons.length === 0,
    structureReasons,
    coverage,
    specificity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM-as-judge (pluggable)
// ─────────────────────────────────────────────────────────────────────────────

export const JUDGE_DIMENSIONS = [
  "faithfulness", // rationale reflects the findings without overstating
  "specificity", // tailored to THIS household vs generic boilerplate
  "tone", // professional, measured, non-alarmist, advisor voice
  "actionability", // next steps are concrete and appropriate to the service
] as const;
export type JudgeDimension = (typeof JUDGE_DIMENSIONS)[number];

export type JudgeScores = {
  /** Each dimension scored 1 (poor) – 5 (excellent). */
  scores: Record<JudgeDimension, number>;
  reasons: Partial<Record<JudgeDimension, string>>;
};

export const JUDGE_SYSTEM_PROMPT = `You are a strict evaluator of AI-written risk-advisory recommendation copy for a firm serving high-net-worth families. You are given the client's assessment findings, the services a rules engine selected, and the AI-written narrative. Score the narrative on each dimension from 1 (poor) to 5 (excellent), with a one-sentence reason each:
- faithfulness: the rationale accurately reflects the client's findings and does not overstate, invent facts/figures, or contradict the input.
- specificity: it is tailored to THIS household's actual answers, not interchangeable boilerplate.
- tone: professional, measured, non-alarmist advisor voice; no guarantees; no definitive legal/tax/investment claims.
- actionability: the next steps are concrete, correct for the service, and something an advisor could act on.
Be exacting: reserve 5 for genuinely strong copy. Return only the structured object.`;

export function buildJudgeSchema() {
  const dimProps = Object.fromEntries(
    JUDGE_DIMENSIONS.flatMap((d) => [
      [`${d}_score`, { type: "integer", minimum: 1, maximum: 5 }],
      [`${d}_reason`, { type: "string" }],
    ]),
  );
  return {
    name: "narrative_judgement",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: JUDGE_DIMENSIONS.flatMap((d) => [`${d}_score`, `${d}_reason`]),
      properties: dimProps,
    },
  } as const;
}

export function renderJudgeUserMessage(
  input: NarrativeInput,
  output: NarrativeOutput,
): string {
  const findings = input.weakFindings.map((f) => ({
    questionNumber: f.questionNumber,
    question: f.questionText,
    clientAnswer: `${f.chosenLevel} — ${f.chosenLabel}`,
  }));
  return [
    "FINDINGS:",
    JSON.stringify(findings, null, 2),
    "SELECTED SERVICES:",
    JSON.stringify(input.selectedServices, null, 2),
    "NARRATIVE TO SCORE:",
    JSON.stringify(output, null, 2),
  ].join("\n");
}

/** Pluggable judge — wire to OpenAI/Anthropic in the runner. */
export type NarrativeJudge = (args: {
  system: string;
  user: string;
  schema: ReturnType<typeof buildJudgeSchema>;
}) => Promise<JudgeScores>;

// ─────────────────────────────────────────────────────────────────────────────
// Combined evaluation
// ─────────────────────────────────────────────────────────────────────────────

export type NarrativeEvalResult = {
  deterministic: DeterministicScore;
  judge?: JudgeScores;
  /** Hard gate: grounded AND full coverage. Ungrounded => fail regardless of judge. */
  passedHardGate: boolean;
  /** 0–100 combined score. */
  score: number;
  verdict: "pass" | "warn" | "fail";
  reasons: string[];
};

const PASS_THRESHOLD = 75;
const WARN_THRESHOLD = 55;

export async function evaluateNarrative(
  input: NarrativeInput,
  output: NarrativeOutput,
  opts: { judge?: NarrativeJudge } = {},
): Promise<NarrativeEvalResult> {
  const deterministic = scoreDeterministic(input, output);
  const passedHardGate = deterministic.grounded && deterministic.coverage === 1;

  const reasons = [...deterministic.groundingReasons, ...deterministic.structureReasons];

  let judge: JudgeScores | undefined;
  if (opts.judge) {
    judge = await opts.judge({
      system: JUDGE_SYSTEM_PROMPT,
      user: renderJudgeUserMessage(input, output),
      schema: buildJudgeSchema(),
    });
  }

  // Deterministic sub-score (0–1): grounding gate + structure + specificity.
  const detScore =
    (deterministic.grounded ? 0.5 : 0) +
    (deterministic.structureOk ? 0.2 : 0) +
    deterministic.specificity * 0.3;

  // Judge sub-score (0–1): mean of the 1–5 dimensions.
  const judgeScore = judge
    ? (JUDGE_DIMENSIONS.reduce((sum, d) => sum + judge!.scores[d], 0) /
        (JUDGE_DIMENSIONS.length * 5))
    : undefined;

  const combined01 =
    judgeScore === undefined ? detScore : 0.4 * detScore + 0.6 * judgeScore;
  const score = Math.round(combined01 * 100);

  let verdict: NarrativeEvalResult["verdict"];
  if (!passedHardGate) verdict = "fail";
  else if (score >= PASS_THRESHOLD) verdict = "pass";
  else if (score >= WARN_THRESHOLD) verdict = "warn";
  else verdict = "fail";

  return { deterministic, judge, passedHardGate, score, verdict, reasons };
}
