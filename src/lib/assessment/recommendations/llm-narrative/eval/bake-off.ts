/**
 * Shape A eval — run the golden set through OpenAI and print a scorecard.
 * This is the ONLY module in the llm-narrative tree that makes real API calls,
 * so it lives as a script (run with tsx), never imported by the app.
 *
 * OpenAI is the platform's existing LLM vendor; the narrative feature stays on
 * it rather than adding a second provider. Use this to iterate the prompt and
 * confirm the hard gate (grounding + full service coverage) holds before wiring
 * generation into scoring.
 *
 *   # deterministic scoring only (grounding, structure, specificity)
 *   npx tsx src/lib/assessment/recommendations/llm-narrative/eval/bake-off.ts
 *
 *   # add the LLM judge for the subjective dimensions
 *   LLM_JUDGE=on npx tsx .../bake-off.ts
 *
 * Env:
 *   LLM_JUDGE        on | off        (default off → deterministic only)
 *   LLM_GEN_MODEL    override the generation model id (default gpt-4o)
 *   LLM_JUDGE_MODEL  override the judge model id
 *
 * Note: with the judge on, the same vendor grades its own output — the
 * deterministic hard gate, not the judge, is the shippability guardrail.
 */

import { GOLDEN_CASES } from "./golden-set";
import { runEval, formatScorecard } from "./run-eval";
import { makeOpenAIGenerate, makeOpenAIJudge } from "../providers/openai-provider";

async function main(): Promise<void> {
  const genModel = process.env.LLM_GEN_MODEL;
  const judgeOn = (process.env.LLM_JUDGE ?? "off").toLowerCase() === "on";
  const judge = judgeOn ? makeOpenAIJudge({ model: process.env.LLM_JUDGE_MODEL }) : undefined;

  console.log(
    `\n=== provider: openai${genModel ? ` (${genModel})` : ""}${
      judgeOn ? " · judge: openai" : " · deterministic only"
    } ===`,
  );

  const { results, summary } = await runEval({
    cases: GOLDEN_CASES.map((c) => ({ id: c.id, input: c.input })),
    generate: makeOpenAIGenerate({ model: genModel }),
    judge,
  });

  console.log(formatScorecard(results, summary));
}

void main();
