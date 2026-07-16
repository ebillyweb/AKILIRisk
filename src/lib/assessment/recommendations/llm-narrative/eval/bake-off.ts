/**
 * Shape A bake-off — run the golden set through a live provider and print a
 * scorecard. This is the ONLY module in the llm-narrative tree that makes real
 * API calls, so it lives as a script (run with tsx), never imported by the app.
 *
 *   # OpenAI generation, deterministic scoring only
 *   LLM_PROVIDER=openai npx tsx src/lib/assessment/recommendations/llm-narrative/eval/bake-off.ts
 *
 *   # Claude generation, judged by GPT-4o (cross-model judge avoids self-grading)
 *   LLM_PROVIDER=anthropic LLM_JUDGE=openai npx tsx .../bake-off.ts
 *
 *   # Both providers, cross-judged, side by side
 *   LLM_PROVIDER=both LLM_JUDGE=anthropic npx tsx .../bake-off.ts
 *
 * Env:
 *   LLM_PROVIDER   openai | anthropic | both      (default openai)
 *   LLM_JUDGE      openai | anthropic | none       (default none → deterministic only)
 *   LLM_GEN_MODEL  override the generation model id
 *   LLM_JUDGE_MODEL override the judge model id
 */

import { GOLDEN_CASES } from "./golden-set";
import { runEval, formatScorecard } from "./run-eval";
import type { NarrativeInput, NarrativeOutput } from "../shape-a-prompt";
import type { NarrativeJudge } from "./rubric";
import { makeOpenAIGenerate, makeOpenAIJudge } from "../providers/openai-provider";
import { makeAnthropicGenerate, makeAnthropicJudge } from "../providers/anthropic-provider";

type ProviderName = "openai" | "anthropic";

function makeGenerate(
  provider: ProviderName,
  model?: string,
): (input: NarrativeInput) => Promise<NarrativeOutput> {
  return provider === "openai"
    ? makeOpenAIGenerate({ model })
    : makeAnthropicGenerate({ model });
}

function makeJudge(judge: string | undefined, model?: string): NarrativeJudge | undefined {
  if (judge === "openai") return makeOpenAIJudge({ model });
  if (judge === "anthropic") return makeAnthropicJudge({ model });
  return undefined;
}

async function runProvider(provider: ProviderName): Promise<void> {
  const genModel = process.env.LLM_GEN_MODEL;
  const judge = makeJudge(process.env.LLM_JUDGE, process.env.LLM_JUDGE_MODEL);

  console.log(`\n=== provider: ${provider}${genModel ? ` (${genModel})` : ""}${
    process.env.LLM_JUDGE && process.env.LLM_JUDGE !== "none"
      ? ` · judge: ${process.env.LLM_JUDGE}`
      : " · deterministic only"
  } ===`);

  const { results, summary } = await runEval({
    cases: GOLDEN_CASES.map((c) => ({ id: c.id, input: c.input })),
    generate: makeGenerate(provider, genModel),
    judge,
  });

  console.log(formatScorecard(results, summary));
}

async function main(): Promise<void> {
  const selection = (process.env.LLM_PROVIDER ?? "openai").toLowerCase();
  const providers: ProviderName[] =
    selection === "both" ? ["openai", "anthropic"] : [selection as ProviderName];

  if (!["openai", "anthropic", "both"].includes(selection)) {
    throw new Error(`LLM_PROVIDER must be openai | anthropic | both (got "${selection}").`);
  }

  for (const p of providers) {
    try {
      await runProvider(p);
    } catch (err) {
      console.error(`\n[${p}] bake-off failed:`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  }
}

void main();
