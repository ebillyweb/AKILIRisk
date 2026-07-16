/**
 * OpenAI adapter for the Shape A narrative bake-off.
 *
 * Wires `buildNarrativeSchema` / `buildJudgeSchema` to OpenAI's Chat Completions
 * structured outputs (`response_format: { type: "json_schema", json_schema }`).
 * Reuses the existing `getOpenAIClient()` so key handling stays in one place.
 *
 * This module is NOT imported by the runtime — only by the bake-off script and
 * its tests (which inject a mock client). No live call happens on import.
 */

import { getOpenAIClient } from "@/lib/openai";
import {
  buildNarrativeSchema,
  NARRATIVE_CALL_PARAMS,
  NARRATIVE_SYSTEM_PROMPT,
  renderNarrativeUserMessage,
  type NarrativeInput,
  type NarrativeOutput,
} from "../shape-a-prompt";
import type { NarrativeJudge } from "../eval/rubric";
import { mapJudgeResult, parseNarrativeJson } from "./shared";

/** Minimal shape of the OpenAI chat-completions surface we depend on. */
export type OpenAILike = {
  chat: {
    completions: {
      create: (args: unknown) => Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
};

export type OpenAIProviderOptions = {
  /** Defaults to gpt-4o (structured-output capable). */
  model?: string;
  /** Injectable for tests; defaults to the shared getOpenAIClient(). */
  client?: OpenAILike;
};

const DEFAULT_MODEL = "gpt-4o";

function resolveClient(opts?: OpenAIProviderOptions): OpenAILike {
  return opts?.client ?? (getOpenAIClient() as unknown as OpenAILike);
}

async function complete(
  client: OpenAILike,
  model: string,
  system: string,
  user: string,
  jsonSchema: { name: string; strict: boolean; schema: unknown },
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const res = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_schema", json_schema: jsonSchema },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = res.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty completion.");
  return content;
}

/** Build a `generate` function for `runEval`. */
export function makeOpenAIGenerate(
  opts?: OpenAIProviderOptions,
): (input: NarrativeInput) => Promise<NarrativeOutput> {
  const client = resolveClient(opts);
  const model = opts?.model ?? DEFAULT_MODEL;
  return async (input) => {
    const schema = buildNarrativeSchema(input.selectedServices.map((s) => s.serviceId));
    const content = await complete(
      client,
      model,
      NARRATIVE_SYSTEM_PROMPT,
      renderNarrativeUserMessage(input),
      schema,
      NARRATIVE_CALL_PARAMS.maxOutputTokens,
      NARRATIVE_CALL_PARAMS.temperature,
    );
    return parseNarrativeJson(content);
  };
}

/** Build a `NarrativeJudge` backed by OpenAI. */
export function makeOpenAIJudge(opts?: OpenAIProviderOptions): NarrativeJudge {
  const client = resolveClient(opts);
  const model = opts?.model ?? DEFAULT_MODEL;
  return async ({ system, user, schema }) => {
    const content = await complete(client, model, system, user, schema, 600, 0);
    return mapJudgeResult(content);
  };
}
