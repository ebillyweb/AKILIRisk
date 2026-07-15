/**
 * Phase 0 eval runner.
 *
 * Feeds each golden-set input through a `generate` function, scores the output
 * with the rubric, and aggregates a scorecard. `generate` is injected so this
 * runs against any model (OpenAI, Anthropic) — or, before the call adapter
 * exists, against the golden set's reference outputs to smoke-test the rubric.
 *
 * There is intentionally no live LLM call in this module: it stays pure and
 * unit-testable. Wire a real `generate`/`judge` from a thin script that owns
 * the API client.
 */

import type { NarrativeInput, NarrativeOutput } from "../shape-a-prompt";
import {
  evaluateNarrative,
  JUDGE_DIMENSIONS,
  type JudgeDimension,
  type NarrativeEvalResult,
  type NarrativeJudge,
} from "./rubric";

export type EvalCase = { id: string; input: NarrativeInput };

export type EvalCaseResult = {
  id: string;
  result?: NarrativeEvalResult;
  /** Set if generation itself threw (counts as a failure). */
  error?: string;
};

export type EvalSummary = {
  total: number;
  pass: number;
  warn: number;
  fail: number;
  errored: number;
  hardGateFailures: number;
  avgScore: number;
  avgSpecificity: number;
  avgCoverage: number;
  /** Present only when a judge was used. */
  avgJudge?: Record<JudgeDimension, number>;
};

export async function runEval(args: {
  cases: EvalCase[];
  generate: (input: NarrativeInput) => Promise<NarrativeOutput>;
  judge?: NarrativeJudge;
}): Promise<{ results: EvalCaseResult[]; summary: EvalSummary }> {
  const results: EvalCaseResult[] = [];

  for (const c of args.cases) {
    try {
      const output = await args.generate(c.input);
      const result = await evaluateNarrative(c.input, output, { judge: args.judge });
      results.push({ id: c.id, result });
    } catch (err) {
      results.push({ id: c.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const scored = results.filter((r) => r.result).map((r) => r.result!);
  const n = scored.length || 1;
  const mean = (fn: (r: NarrativeEvalResult) => number) =>
    scored.reduce((s, r) => s + fn(r), 0) / n;

  const usedJudge = scored.some((r) => r.judge);
  const avgJudge = usedJudge
    ? (Object.fromEntries(
        JUDGE_DIMENSIONS.map((d) => [
          d,
          scored.reduce((s, r) => s + (r.judge?.scores[d] ?? 0), 0) / n,
        ]),
      ) as Record<JudgeDimension, number>)
    : undefined;

  const summary: EvalSummary = {
    total: results.length,
    pass: scored.filter((r) => r.verdict === "pass").length,
    warn: scored.filter((r) => r.verdict === "warn").length,
    fail: scored.filter((r) => r.verdict === "fail").length,
    errored: results.filter((r) => r.error).length,
    hardGateFailures: scored.filter((r) => !r.passedHardGate).length,
    avgScore: Math.round(mean((r) => r.score)),
    avgSpecificity: Number(mean((r) => r.deterministic.specificity).toFixed(2)),
    avgCoverage: Number(mean((r) => r.deterministic.coverage).toFixed(2)),
    avgJudge,
  };

  return { results, summary };
}

/** Human-readable scorecard for a CLI/CI run. */
export function formatScorecard(
  results: EvalCaseResult[],
  summary: EvalSummary,
): string {
  const icon = (v?: string, err?: string) =>
    err ? "ERR " : v === "pass" ? "PASS" : v === "warn" ? "WARN" : "FAIL";
  const lines: string[] = [];
  lines.push("LLM narrative eval — Phase 0");
  lines.push("─".repeat(52));
  for (const r of results) {
    const s = r.result;
    const detail = r.error
      ? r.error
      : `score ${s!.score}  cov ${s!.deterministic.coverage}  spec ${s!.deterministic.specificity.toFixed(2)}` +
        (s!.passedHardGate ? "" : "  [HARD-GATE FAIL]");
    lines.push(`${icon(s?.verdict, r.error).padEnd(5)} ${r.id.padEnd(34)} ${detail}`);
    if (s && s.reasons.length) {
      for (const reason of s.reasons) lines.push(`       - ${reason}`);
    }
  }
  lines.push("─".repeat(52));
  lines.push(
    `${summary.pass} pass · ${summary.warn} warn · ${summary.fail} fail · ${summary.errored} errored` +
      `   avg ${summary.avgScore}/100   hard-gate fails ${summary.hardGateFailures}`,
  );
  if (summary.avgJudge) {
    lines.push(
      "judge avg: " +
        JUDGE_DIMENSIONS.map((d) => `${d} ${summary.avgJudge![d].toFixed(1)}`).join("  "),
    );
  }
  return lines.join("\n");
}
