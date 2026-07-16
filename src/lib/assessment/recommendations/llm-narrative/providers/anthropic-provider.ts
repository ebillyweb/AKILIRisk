/**
 * Anthropic (Claude) adapter for the Shape A narrative bake-off.
 *
 * `@anthropic-ai/sdk` is an OPTIONAL dependency: it is loaded via a runtime
 * dynamic import behind a variable specifier so TypeScript does not treat it as
 * a hard build dependency and the app builds/tests without it installed. The
 * bake-off script installs it on demand; the unit tests inject a mock client.
 *
 * Structured outputs use `output_config.format` json_schema (supported on Opus
 * 4.8 / Sonnet 5 / Haiku 4.5). Model defaults to `claude-opus-4-8`. Extended
 * thinking is intentionally left off so temperature stays at the narrative
 * setting (0.3) for consistency/cacheability — this is short, constrained copy,
 * not open-ended reasoning.
 */

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

/** Minimal shape of the Anthropic messages surface we depend on. */
export type AnthropicLike = {
  messages: {
    create: (args: unknown) => Promise<{
      content: Array<{ type: string; text?: string }>;
    }>;
  };
};

export type AnthropicProviderOptions = {
  /** Defaults to claude-opus-4-8. */
  model?: string;
  /** Injectable for tests; otherwise the SDK is dynamically imported. */
  client?: AnthropicLike;
};

const DEFAULT_MODEL = "claude-opus-4-8";

/** Load `@anthropic-ai/sdk` lazily. Variable specifier keeps it optional to TS. */
async function loadAnthropicClient(): Promise<AnthropicLike> {
  const moduleName = "@anthropic-ai/sdk";
  let mod: { default?: new () => AnthropicLike };
  try {
    mod = (await import(/* @vite-ignore */ moduleName)) as {
      default?: new () => AnthropicLike;
    };
  } catch {
    throw new Error(
      "@anthropic-ai/sdk is not installed. Run `npm i @anthropic-ai/sdk` to use the Anthropic provider.",
    );
  }
  const Anthropic = mod.default;
  if (!Anthropic) throw new Error("@anthropic-ai/sdk did not export a default client.");
  return new Anthropic();
}

async function resolveClient(opts?: AnthropicProviderOptions): Promise<AnthropicLike> {
  return opts?.client ?? (await loadAnthropicClient());
}

async function complete(
  client: AnthropicLike,
  model: string,
  system: string,
  user: string,
  schema: unknown,
  maxTokens: number,
  temperature: number,
): Promise<string> {
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { format: { type: "json_schema", schema } },
  });
  const text = res.content
    ?.filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("Claude returned no text content.");
  return text;
}

/** Build a `generate` function for `runEval`. */
export function makeAnthropicGenerate(
  opts?: AnthropicProviderOptions,
): (input: NarrativeInput) => Promise<NarrativeOutput> {
  const model = opts?.model ?? DEFAULT_MODEL;
  return async (input) => {
    const client = await resolveClient(opts);
    const { schema } = buildNarrativeSchema(input.selectedServices.map((s) => s.serviceId));
    const text = await complete(
      client,
      model,
      NARRATIVE_SYSTEM_PROMPT,
      renderNarrativeUserMessage(input),
      schema,
      NARRATIVE_CALL_PARAMS.maxOutputTokens,
      NARRATIVE_CALL_PARAMS.temperature,
    );
    return parseNarrativeJson(text);
  };
}

/** Build a `NarrativeJudge` backed by Claude. */
export function makeAnthropicJudge(opts?: AnthropicProviderOptions): NarrativeJudge {
  const model = opts?.model ?? DEFAULT_MODEL;
  return async ({ system, user, schema }) => {
    const client = await resolveClient(opts);
    const text = await complete(client, model, system, user, schema.schema, 600, 0);
    return mapJudgeResult(text);
  };
}
