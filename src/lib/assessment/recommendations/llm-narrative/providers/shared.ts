/**
 * Shared plumbing for the LLM provider adapter.
 *
 * The provider speaks a structured-output shape — `buildNarrativeSchema` for
 * generation, `buildJudgeSchema` for the judge — so the only real work is
 * (a) safely parsing the model's JSON and (b) flattening the judge's per-dimension
 * fields back into the rubric's `JudgeScores`. Kept separate from the OpenAI
 * client so it stays pure and unit-testable, and so a second provider could
 * reuse it later without duplication.
 */

import type { NarrativeOutput } from "../shape-a-prompt";
import {
  JUDGE_DIMENSIONS,
  type JudgeDimension,
  type JudgeScores,
} from "../eval/rubric";

/** Parse a model's JSON text into a NarrativeOutput, tolerating stray wrapping. */
export function parseNarrativeJson(raw: string): NarrativeOutput {
  const text = stripCodeFence(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Model did not return valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const obj = parsed as Partial<NarrativeOutput>;
  if (typeof obj?.pillarSummary !== "string" || !Array.isArray(obj?.recommendations)) {
    throw new Error("Model JSON is missing pillarSummary/recommendations.");
  }
  return obj as NarrativeOutput;
}

/**
 * Flatten the judge schema's `<dim>_score` / `<dim>_reason` fields into the
 * rubric's `JudgeScores`. Accepts an already-parsed object or a JSON string.
 */
export function mapJudgeResult(raw: unknown): JudgeScores {
  const obj = typeof raw === "string" ? JSON.parse(stripCodeFence(raw)) : raw;
  const record = (obj ?? {}) as Record<string, unknown>;
  const scores = {} as Record<JudgeDimension, number>;
  const reasons: Partial<Record<JudgeDimension, string>> = {};
  for (const d of JUDGE_DIMENSIONS) {
    const score = Number(record[`${d}_score`]);
    scores[d] = Number.isFinite(score) ? score : 0;
    const reason = record[`${d}_reason`];
    if (typeof reason === "string") reasons[d] = reason;
  }
  return { scores, reasons };
}

/** Strip a leading/trailing ```json … ``` fence if the model added one. */
function stripCodeFence(text: string): string {
  const fenced = text.match(/^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/);
  return fenced ? fenced[1] : text;
}
